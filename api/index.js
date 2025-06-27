// api/index.js
const express = require('express');
const path = require('path');
const { MercadoPagoConfig, Preference } = require('mercadopago'); // <-- MUDANÇA AQUI: Importação específica
const dotenv = require('dotenv');

// Carregar variáveis de ambiente do .env
dotenv.config();

const app = express();

// Instanciar o MercadoPagoConfig com o access_token
// client é o nome sugerido pela documentação mais recente do MP
const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN }); // <-- MUDANÇA AQUI: Nova forma de configurar

// Middleware para parsear JSON e URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Servir arquivos estáticos da pasta 'public'
app.use(express.static(path.join(__dirname, '../public')));

// Rota para a página de produto (agora servida como arquivo estático pelo Vercel)
app.get('/product', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'product.html'));
});

// Rota para criar preferência de pagamento com Mercado Pago
app.post('/create_preference', async (req, res) => {
    const { amount, description, payer_email, product_id, quantity, selected_size } = req.body;

    if (!amount || !description || !payer_email || !product_id) {
        return res.status(400).json({ error: 'Missing required fields for preference creation.' });
    }

    try {
        const preference = new Preference(client); // <-- MUDANÇA AQUI: Instanciar Preference com o client

        const response = await preference.create({
            body: { // O corpo da preferência agora vai dentro de 'body'
                items: [
                    {
                        id: product_id,
                        title: description,
                        unit_price: parseFloat(amount),
                        quantity: quantity || 1,
                        description: selected_size ? `${description} (Tamanho: ${selected_size})` : description
                    }
                ],
                payer: {
                    email: payer_email
                },
                back_urls: {
                    success: `${process.env.APP_BASE_URL}/success`,
                    failure: `${process.env.APP_BASE_URL}/failure`,
                    pending: `${process.env.APP_BASE_URL}/pending`
                },
                auto_return: "approved"
            }
        });

        res.json({ id: response.id, initPoint: response.init_point, sandboxInitPoint: response.sandbox_init_point });
    } catch (error) {
        console.error('Error creating MP preference:', error);
        // Logar o erro completo para depuração
        if (error.cause && error.cause.data) {
             console.error('Mercado Pago API error details:', error.cause.data);
        }
        res.status(500).json({ error: 'Failed to create Mercado Pago preference.', details: error.message });
    }
});

// Rotas de retorno do Mercado Pago (simplesmente exibe uma mensagem)
app.get('/success', (req, res) => {
    res.send('Pagamento realizado com sucesso! 🎉');
});

app.get('/failure', (req, res) => {
    res.send('Pagamento falhou. Tente novamente. 🙁');
});

app.get('/pending', (req, res) => {
    res.send('Pagamento pendente. Aguardando confirmação. ⏳');
});

// Exporta o aplicativo Express como uma função serverless
module.exports = app;

