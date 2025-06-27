// api/index.js
const express = require('express');
const path = require('path');
const { MercadoPagoConfig, Preference } = require('mercadopago'); // <-- Importação CORRETA
const dotenv = require('dotenv');

dotenv.config(); // Carrega variáveis do .env LOCALMENTE (não afeta Vercel)

const app = express();

// Configuração do Mercado Pago (usando a nova API)
const client = new MercadoPagoConfig({ accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN }); // <-- AQUI DEVE SER 'MERCADO_PAGO_ACCESS_TOKEN'

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(express.static(path.join(__dirname, '../public')));

app.get('/product', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'product.html'));
});

app.post('/create_preference', async (req, res) => {
    const { amount, description, payer_email, product_id, quantity, selected_size } = req.body;

    if (!amount || !description || !payer_email || !product_id) {
        return res.status(400).json({ error: 'Missing required fields for preference creation.' });
    }

    try {
        const preference = new Preference(client); // Instancia Preference com o client configurado

        const response = await preference.create({
            body: {
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
        if (error.cause && error.cause.data) {
             console.error('Mercado Pago API error details:', error.cause.data);
        }
        res.status(500).json({ error: 'Failed to create Mercado Pago preference.', details: error.message });
    }
});

app.get('/success', (req, res) => {
    res.send('Pagamento realizado com sucesso! 🎉');
});

app.get('/failure', (req, res) => {
    res.send('Pagamento falhou. Tente novamente. 🙁');
});

app.get('/pending', (req, res) => {
    res.send('Pagamento pendente. Aguardando confirmação. ⏳');
});

module.exports = app;

