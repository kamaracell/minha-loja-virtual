$(document).ready(function() {
    // Lógica para o carrossel de imagens (mantida do código anterior)
    const mainProductImage = $('#mainProductImage');
    const thumbnailGallery = $('#thumbnailGallery');

    thumbnailGallery.on('click', '.thumbnail', function() {
        const newSrc = $(this).attr('src').replace('100x70', '600x400');
        mainProductImage.attr('src', newSrc);

        thumbnailGallery.find('.thumbnail').removeClass('active');
        $(this).addClass('active');
    });

    mainProductImage.on('click', function() {
        window.open(mainProductImage.attr('src'), '_blank');
    });

    // --- NOVA LÓGICA: Botão Adicionar ao Carrinho e Pagamento ---
    const checkoutButton = $('#checkoutButton'); // Seleciona o botão pelo ID

    checkoutButton.on('click', async function() {
        // Desabilita o botão para evitar cliques múltiplos
        $(this).text('Processando...').prop('disabled', true);

        // Coleta informações básicas do produto da página (para este exemplo)
        const amount = parseFloat($('#productPrice').text().replace('R$', '').replace(',', '.').trim());
        const description = $('#productTitle').text().trim();
        const productId = 'prod_001'; // ID do produto fixo para este exemplo. Depois pode vir de um DB.
        const payerEmail = 'test_user@example.com'; // Email de teste para o comprador

        if (isNaN(amount) || amount <= 0) {
            alert('Valor do produto inválido.');
            $(this).text('Adicionar ao Carrinho').prop('disabled', false);
            return;
        }

        try {
            // Envia os dados do pedido para o seu backend Node.js
            const response = await fetch('/create_preference', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    amount: amount,
                    description: description,
                    payer_email: payerEmail,
                    product_id: productId,
                    quantity: 1 // Quantidade fixa por enquanto
                }),
            });

            const data = await response.json();

            if (response.ok) {
                console.log('Preferência criada:', data);
                // Redireciona o usuário para o link de pagamento do Mercado Pago
                window.location.href = data.sandboxInitPoint; // Use sandboxInitPoint para testes!
            } else {
                console.error('Erro ao criar preferência:', data.error);
                alert('Erro ao processar o pagamento: ' + (data.details || data.error));
            }

        } catch (error) {
            console.error('Erro na requisição:', error);
            alert('Não foi possível conectar com o servidor para processar o pagamento.');
        } finally {
            // Habilita o botão novamente após a tentativa (se não houver redirecionamento)
            if (window.location.href.indexOf(checkoutButton.attr('href')) === -1) {
                $(this).text('Adicionar ao Carrinho').prop('disabled', false);
            }
        }
    });

    // Não há necessidade de loadProductDetails por enquanto, pois os dados são fixos na página.
});

