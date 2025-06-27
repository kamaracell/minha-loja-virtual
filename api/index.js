// api/index.js (VERSÃO FINAL - Com todas as rotas)
const express = require('express');
const path = require('path');
const { MercadoPagoConfig, Preference } = require('mercadopago');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

const client = new MercadoPagoConfig({ accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN });

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(express.static(path.join(__dirname, '../public')));

// Rota para a página de produto
app.get('/product', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'product.html'));
});

// Rota para criar preferência de pagamento no Mercado Pago
app.post('/create_preference', async (req, res) => {
    const { amount, description, payer_email, product_id, quantity, selected_size } = req.body;

    if (!amount || !description || !payer_email || !product_id) {
        return res.status(400).json({ error: 'Missing required fields for preference creation.' });
    }

    try {
        const preference = new Preference(client);

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

// Rotas de retorno do Mercado Pago
app.get('/success', (req, res) => {
    res.send('Pagamento realizado com sucesso! 🎉');
});

app.get('/failure', (req, res) => {
    res.send('Pagamento falhou. Tente novamente. 🙁');
});

app.get('/pending', (req, res) => {
    res.send('Pagamento pendente. Aguardando confirmação. ⏳');
});

// Bloco de escuta do servidor (para uso local)
const PORT = process.env.PORT || 3000;

try {
    app.listen(PORT, () => {
        console.log(`Full Express server running on http://localhost:${PORT}`);
        console.log('Press Ctrl+C to stop the server.');
    });
} catch (error) {
    console.error('Failed to start full Express server:', error);
}

// Exporta o aplicativo Express como uma função serverless
module.exports = app;
