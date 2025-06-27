// api/index.js
const express = require('express');
const path = require('path');
const mercadopago = require('mercadopago');
const dotenv = require('dotenv');

// Carregar variáveis de ambiente do .env
dotenv.config();

const app = express();

// Configurar Mercado Pago
mercadopago.configure({
    access_token: process.env.MP_ACCESS_TOKEN
});

// Middleware para parsear JSON e URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Servir arquivos estáticos da pasta 'public'
// Esta parte não será mais usada diretamente pelo Vercel para servir o HTML/CSS/JS
// O Vercel fará isso de forma mais eficiente.
// Manteremos para testes locais, mas o vercel.json lidará com isso no deploy.
app.use(express.static(path.join(__dirname, '../public')));

// Rota para a página de produto (agora servida como arquivo estático pelo Vercel)
// O Vercel irá rotear /product para public/product.html automaticamente via vercel.json
app.get('/product', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'product.html'));
});

// Rota para criar preferência de pagamento com Mercado Pago
app.post('/create_preference', async (req, res) => {
    const { amount, description, payer_email, product_id, quantity, selected_size } = req.body;

    if (!amount || !description || !payer_email || !product_id) {
        return res.status(400).json({ error: 'Missing required fields for preference creation.' });
    }

    let preference = {
        items: [
            {
                id: product_id,
                title: description,
                unit_price: parseFloat(amount),
                quantity: quantity || 1, // Assume 1 se não especificado
                // Adiciona o tamanho selecionado como uma descrição extra ou atributo
                // Isso não é um campo padrão do MP, mas pode ser útil para seu controle
                // Você pode querer gerenciar isso em metadata se for mais complexo
                // No momento, apenas como parte da descrição para simplicidade
                description: selected_size ? `${description} (Tamanho: ${selected_size})` : description
            }
        ],
        payer: {
            email: payer_email
        },
        back_urls: {
            success: `${process.env.APP_BASE_URL}/success`, // Redirecionar após sucesso
            failure: `${process.env.APP_BASE_URL}/failure`, // Redirecionar após falha
            pending: `${process.env.APP_BASE_URL}/pending`  // Redirecionar após pendente
        },
        auto_return: "approved"
    };

    try {
        const response = await mercadopago.preferences.create(preference);
        res.json({ id: response.body.id, initPoint: response.body.init_point, sandboxInitPoint: response.body.sandbox_init_point });
    } catch (error) {
        console.error('Error creating MP preference:', error);
        res.status(500).json({ error: 'Failed to create Mercado Pago preference.' });
    }
});

// Rotas de retorno do Mercado Pago (simplesmente exibe uma mensagem)
app.get('/success', (req, res) => {
    res.send('Pagamento realizado com sucesso! 🎉');
    // Aqui você processaria o sucesso, atualizaria o banco de dados, etc.
});

app.get('/failure', (req, res) => {
    res.send('Pagamento falhou. Tente novamente. 🙁');
});

app.get('/pending', (req, res) => {
    res.send('Pagamento pendente. Aguardando confirmação. ⏳');
});

// Exporta o aplicativo Express como uma função serverless
module.exports = app;

