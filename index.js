require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const app = express();
const port = process.env.PORT || 3000;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const mpAccessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
const appBaseUrl = process.env.APP_BASE_URL || `http://localhost:${port}`;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey || !mpAccessToken) {
    console.error('ERRO: Variáveis de ambiente críticas não estão configuradas!');
    console.error('Verifique seu arquivo .env e as configurações da plataforma de deploy.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static('public'));

app.get('/', (req, res) => {
    res.send('<h1>Bem-vindo à Loja Virtual!</h1><p>Acesse <a href="/product">/product</a> para ver a página de exemplo.</p>');
});

app.get('/product', (req, res) => {
    res.sendFile(__dirname + '/public/product.html');
});

app.post('/create_preference', async (req, res) => {
    const { amount, description, payer_email, product_id, quantity = 1 } = req.body;

    if (!amount || !description || !payer_email || !product_id) {
        return res.status(400).json({ error: 'Missing required fields: amount, description, payer_email, product_id' });
    }

    try {
        const { data: newOrder, error: createOrderError } = await supabaseAdmin
            .from('orders')
            .insert({
                product_id: product_id,
                quantity: quantity,
                total_amount: amount,
                status: 'pending',
                payer_email: payer_email,
                mp_preference_id: null,
                mp_payment_id: null,
                mp_status: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (createOrderError) {
            console.error('Erro ao criar pedido no Supabase:', createOrderError);
            return res.status(500).json({ error: 'Erro ao criar pedido no Supabase.', details: createOrderError.message });
        }

        const orderId = newOrder.id;
        console.log(`Pedido ${orderId} criado no Supabase com status 'pending'.`);

        const preferenceData = {
            items: [
                {
                    title: description,
                    unit_price: parseFloat(amount),
                    quantity: quantity,
                },
            ],
            payer: {
                email: payer_email,
            },
            back_urls: {
                success: `${appBaseUrl}/feedback?status=success&orderId=${orderId}`,
                failure: `${appBaseUrl}/feedback?status=failure&orderId=${orderId}`,
                pending: `${appBaseUrl}/feedback?status=pending&orderId=${orderId}`,
            },
            auto_return: "approved_only",
            notification_url: `${appBaseUrl}/webhooks/mercadopago?orderId=${orderId}`,
            external_reference: orderId.toString(),
        };

        const mpResponse = await axios.post('https://api.mercadopago.com/checkout/preferences', preferenceData, {
            headers: {
                'Authorization': `Bearer ${mpAccessToken}`,
                'Content-Type': 'application/json',
            },
        });

        const preferenceId = mpResponse.data.id;
        const sandboxInitPoint = mpResponse.data.sandbox_init_point;
        const initPoint = mpResponse.data.init_point;

        console.log(`Preferência do Mercado Pago criada: ${preferenceId}`);

        const { data: updatedOrder, error: updateOrderError } = await supabaseAdmin
            .from('orders')
            .update({
                mp_preference_id: preferenceId,
                updated_at: new Date().toISOString(),
            })
            .eq('id', orderId)
            .select()
            .single();

        if (updateOrderError) {
            console.error('Erro ao atualizar pedido com mp_preference_id no Supabase:', updateOrderError);
            return res.status(500).json({ error: 'Erro ao atualizar pedido com preferência do Mercado Pago.', details: updateOrderError.message });
        }

        res.json({
            preferenceId: preferenceId,
            sandboxInitPoint: sandboxInitPoint,
            initPoint: initPoint,
            orderId: orderId,
        });

    } catch (error) {
        console.error('Erro ao criar preferência de pagamento:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Erro ao criar preferência de pagamento.', details: error.response ? error.response.data : error.message });
    }
});

async function updateOrderWithRetry(orderId, updateData, retries = 5, delay = 1000) {
    for (let i = 0; i < retries; i++) {
        const { data, error } = await supabaseAdmin
            .from('orders')
            .update(updateData)
            .eq('id', orderId);

        if (!error) {
            console.log(`Pedido ${orderId} atualizado com sucesso no Supabase.`);
            return { data, error: null };
        }

        console.warn(`Tentativa ${i + 1} falhou para o pedido ${orderId}: ${error.message}. Tentando novamente em ${delay}ms...`);
        await new Promise(res => setTimeout(res, delay));
        delay *= 2;
    }
    console.error(`Falha ao atualizar o pedido ${orderId} após ${retries} tentativas.`);
    return { data: null, error: new Error(`Falha ao atualizar o pedido ${orderId} após ${retries} tentativas.`) };
}

app.post('/webhooks/mercadopago', async (req, res) => {
    const { topic, id } = req.query;
    const orderId = req.query.orderId;

    console.log(`Webhook Mercado Pago recebido. Tópico: ${topic}, ID: ${id}, Order ID Supabase: ${orderId}`);

    if (!orderId) {
        return res.status(400).send('Order ID is required in webhook query parameters.');
    }

    if (topic === 'payment') {
        try {
            const paymentResponse = await axios.get(`https://api.mercadopago.com/v1/payments/${id}`, {
                headers: {
                    'Authorization': `Bearer ${mpAccessToken}`,
                },
            });

            const payment = paymentResponse.data;
            const paymentStatus = payment.status;
            const paymentId = payment.id;
            const paymentExternalReference = payment.external_reference;

            console.log(`Detalhes do pagamento MP (ID: ${paymentId}): status ${paymentStatus}, external_reference ${paymentExternalReference}`);

            if (paymentExternalReference && paymentExternalReference.toString() === orderId.toString()) {
                const updateData = {
                    mp_payment_id: paymentId,
                    mp_status: paymentStatus,
                    status: paymentStatus === 'approved' ? 'completed' : paymentStatus,
                    updated_at: new Date().toISOString(),
                };

                const { error } = await updateOrderWithRetry(orderId, updateData);

                if (error) {
                    console.error('Erro ao atualizar status do pedido no Supabase via webhook:', error.message);
                    return res.status(500).send('Erro interno ao processar webhook.');
                }
            } else {
                console.warn(`Webhook: external_reference (${paymentExternalReference}) não corresponde ao orderId do query (${orderId}). Ignorando.`);
            }

            res.status(200).send('Webhook processado com sucesso.');

        } catch (error) {
            console.error('Erro ao processar webhook do Mercado Pago:', error.response ? error.response.data : error.message);
            res.status(500).send('Erro ao processar webhook do Mercado Pago.');
        }
    } else if (topic === 'merchant_order') {
        console.log(`Webhook de merchant_order recebido para ID: ${id}.`);
        res.status(200).send('Webhook de merchant_order processado (sem ação específica).');
    } else {
        console.log(`Webhook com tópico desconhecido: ${topic}.`);
        res.status(200).send('Tópico de webhook desconhecido, ignorando.');
    }
});

app.get('/feedback', (req, res) => {
    const { status, orderId } = req.query;
    let message = '';
    let title = '';
    if (status === 'success') {
        title = 'Pagamento Aprovado!';
        message = `Seu pagamento foi aprovado com sucesso! ID do Pedido: ${orderId}. Em breve você receberá a confirmação por e-mail.`;
    } else if (status === 'pending') {
        title = 'Pagamento Pendente';
        message = `Seu pagamento está pendente. ID do Pedido: ${orderId}. Assim que for aprovado, você será notificado.`;
    } else if (status === 'failure') {
        title = 'Pagamento Recusado';
        message = `Seu pagamento foi recusado. ID do Pedido: ${orderId}. Por favor, tente novamente ou use outro método de pagamento.`;
    } else {
        title = 'Status do Pagamento Desconhecido';
        message = `Não foi possível determinar o status do seu pagamento. ID do Pedido: ${orderId}.`;
    }
    res.send(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${title}</title>
            <style>
                body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                h1 { color: ${status === 'success' ? '#28a745' : (status === 'failure' ? '#dc3545' : '#ffc107')}; }
                .container { max-width: 600px; margin: 0 auto; background: #fff; padding: 30px; border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>${title}</h1>
                <p>${message}</p>
                <p>Obrigado por sua compra!</p>
                <a href="/">Voltar à loja</a>
            </div>
        </body>
        </html>
    `);
});

app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
    console.log(`Acesse a página de produto em http://localhost:${port}/product`);
});

