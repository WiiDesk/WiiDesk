function buttonInitHoverSfx() {
    document.querySelectorAll('.returndialog .actions a, .buttonlikeshop, .buttonlikeshop2, .titles .product').forEach(function(el) {
        if (el.dataset.sfxBound) return;
        el.dataset.sfxBound = '1';

        el.addEventListener('mouseenter', function() {
            playSFX('button-hover.mp3', userConfig.sfxVol);
        });

        if (el.classList.contains('buttonlikeshop') || el.classList.contains('buttonlikeshop2')) {
            if (el.parentElement.classList.contains('bottom')) return;
            el.addEventListener('click', function() {
                playSFX('button-select-big.mp3', userConfig.sfxVol);
                if (el.getAttribute('page')) changePage(el.getAttribute('page'));
            });
        }
    });
}