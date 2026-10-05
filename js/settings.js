function setSettingsTo(page) {
    document.getElementById('setting-pages').innerHTML = settingPageHtml(page);
    wireSettingsButtons();
}

function wireSettingsButtons() {
    document.querySelectorAll('#setting-page button').forEach(function(btn) {
        btn.addEventListener('mouseover', function() {
            playSFX('button-hover.mp3', userConfig.sfxVol);
        });

        btn.addEventListener('click', function() {
            if (btn.getAttribute('special') === 'back') {
                playSFX('button-cancel.mp3', userConfig.sfxVol);
            } else {
                playSFX('button-select-big.mp3', userConfig.sfxVol);
            }
            setSettingsTo(btn.getAttribute('goto'));
        });
    });

    document.querySelectorAll('#setting-page input[type="range"]').forEach(function(slider) {
        slider.addEventListener('mouseover', function() {
            playSFX('button-hover.mp3', userConfig.sfxVol);
        });

        slider.addEventListener('input', function() {
            var key = slider.getAttribute('saveto');
            if (!key) {
                console.log('unbound slider:', slider.value);
                return;
            }
            if (!(key in userConfig)) {
                console.error('slider points at unknown config key:', key);
                return;
            }
            userConfig[key] = slider.value;
            WiiDeskStorage.save('wiidesk-settings', userConfig);
        });
    });
}

function settingsBtn(label, goto, isBack) {
    return '<button class="set-btn" goto="' + goto + '"' + (isBack ? ' special="back"' : '') + '>' + label + '</button>';
}

function settingsSlider(label, opts) {
    return '<div class="set-slider">' +
        '<h3>' + label + '</h3>' +
        '<input type="range" min="' + opts.min + '" max="' + opts.max +
        '" step="' + opts.step + '" value="' + opts.value +
        '" saveto="' + (opts.saveto || '') + '">' +
        '</div>';
}

function settingPageHtml(page) {
    switch (page) {
        case 'index':
            return wrapPage(
                settingsBtn('This is a Test Button', 'test') +
                settingsBtn('Change System Volume', 'volume') +
                settingsBtn('Format Wii System Memory', 'format')
            ) + versionPage();

        case 'test':
            return wrapPage(
                'This is a Test Menu' +
                settingsBtn('Return to Settings', 'index', true) +
                settingsSlider('Test Slider (logged to console)', { min: 0, max: 100, step: 1, value: 50 })
            );

        case 'volume':
            return wrapPage(
                settingsSlider('Sound Effects', { min: 0, max: 1, step: .05, value: userConfig.sfxVol, saveto: 'sfxVol' }) +
                settingsSlider('Music', { min: 0, max: 1, step: .05, value: userConfig.musicVol, saveto: 'musicVol' }) +
                settingsBtn('Return to Settings', 'index', true)
            );

        case 'format':
            return wrapPage(
                "You can't do this yet, wait for the next update" +
                settingsBtn('Return to Settings', 'index', true)
            );

        default:
            return wrapPage(
                "that page doesn't exist" +
                settingsBtn('Return to Settings', 'index', true)
            ) + versionPage();
    }
}

function wrapPage(inner) {
    return '<div id="setting-page"><div class="content">' + inner + '</div></div>';
}

function versionPage() {
    return '<div id="setting-page" class="ver"><div class="content">' +
        'Website version&nbsp;<span id="versionprint">a</span><br>' +
        'WiiDesk latest available: <span id="updatedver"></span><br>' +
        'Based upon Wii System 4.3E' +
        '</div></div>';
}