document.addEventListener('DOMContentLoaded', () => {
    const mainImage = document.getElementById('product-main-image');
    const carouselItems = document.querySelectorAll('.image-carousel .carousel-item img');
    const productOptions = document.querySelector('.product-options');
    const productSizeSelect = document.getElementById('product-size');

    // --- Lógica do Carrossel de Imagens ---
    carouselItems.forEach(item => {
        item.addEventListener('click', () => {
            // Remove a classe 'active' de todos os itens do carrossel
            carouselItems.forEach(img => img.classList.remove('active'));
            // Adiciona a classe 'active' ao item clicado
            item.classList.add('active');
            // Troca a imagem principal pela imagem clicada no carrossel
            mainImage.src = item.src;
            mainImage.alt = item.alt;
        });
    });

    // Simulação: Se o produto tiver variantes, mostre a seção de opções
    // No futuro, isso virá de uma chamada API que buscará os detalhes do produto
    const hasVariants = true; // Altere para 'false' para testar sem variantes
    if (hasVariants) {
        productOptions.style.display = 'block';
        // Simulação: Carrega opções de tamanho (no futuro, virá do backend)
        // Criei opções dummy no HTML para você ver o seletor.
        // Aqui você faria um loop para preencher o <select> com dados do Supabase.
    }

    // --- Lógica de Seleção de Tamanho (Exemplo) ---
    productSizeSelect.addEventListener('change', (event) => {
        const selectedSize = event.target.value;
        if (selectedSize) {
            console.log('Tamanho selecionado:', selectedSize);
            // Aqui você pode:
            // - Atualizar o preço se tamanhos tiverem preços diferentes
            // - Validar estoque (se o backend fornecer essa info por variante)
            // - Atualizar um campo hidden no formulário para enviar o tamanho
            const hiddenSizeInput = document.createElement('input');
            hiddenSizeInput.type = 'hidden';
            hiddenSizeInput.name = 'selected_size'; // Nome do campo para enviar ao backend
            hiddenSizeInput.value = selectedSize;
            // Remover input anterior se existir
            const existingSizeInput = document.querySelector('input[name="selected_size"]');
            if (existingSizeInput) {
                existingSizeInput.remove();
            }
            document.getElementById('checkout-form').appendChild(hiddenSizeInput);
        } else {
            console.log('Nenhum tamanho selecionado.');
            const existingSizeInput = document.querySelector('input[name="selected_size"]');
            if (existingSizeInput) {
                existingSizeInput.remove();
            }
        }
    });

    // --- Integração Mercado Pago (Mantido do seu código anterior) ---
    // Este bloco pode ser ajustado para pegar dados dinâmicos do produto
    const form = document.getElementById('checkout-form');
    form.addEventListener('submit', async (event) => {
        event.preventDefault(); // Evita o envio padrão do formulário

        const productId = document.getElementById('product-id').value;
        const amount = parseFloat(document.getElementById('product-amount').value);
        const description = document.getElementById('product-description').value;
        const payerEmail = document.getElementById('payer-email').value;

        // Adiciona o tamanho selecionado, se houver
        const selectedSizeInput = document.querySelector('input[name="selected_size"]');
        const selectedSize = selectedSizeInput ? selectedSizeInput.value : null;

        // Simulação de quantidade, se você não tiver um campo de quantidade no HTML
        const quantity = 1; 

        try {
            const response = await fetch('/create_preference', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    amount,
                    description,
                    payer_email: payerEmail,
                    product_id: productId,
                    quantity,
                    // Inclua a variante selecionada no body, se houver
                    selected_size: selectedSize 
                }),
            });

            const data = await response.json();

            if (data.error) {
                alert('Erro ao criar preferência de pagamento: ' + data.error);
            } else {
                // Redireciona para o checkout do Mercado Pago
                window.location.href = data.sandboxInitPoint || data.initPoint;
            }
        } catch (error) {
            console.error('Erro de rede ou servidor:', error);
            alert('Ocorreu um erro ao processar seu pagamento. Tente novamente.');
        }
    });

    // Inicializa a primeira imagem do carrossel como ativa, se houver
    if (carouselItems.length > 0) {
        carouselItems[0].classList.add('active');
        mainImage.src = carouselItems[0].src;
        mainImage.alt = carouselItems[0].alt;
    }
});

