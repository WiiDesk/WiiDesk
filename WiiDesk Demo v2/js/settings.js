function initSettings() {
    document.querySelectorAll('#setting-page button').forEach(elmnt => {
        elmnt.addEventListener('mouseover', (event) => {
            playSFX('button-hover.mp3', userConfig.sfxVol);
        });
        elmnt.addEventListener('click', (event) => {
            if (elmnt.getAttribute('special') !== "undefined" && elmnt.getAttribute('special') !== null) {
                if (elmnt.getAttribute('special') == "back") {
                    playSFX('button-cancel.mp3', userConfig.sfxVol);
                }
            } else {
                playSFX('button-select-big.mp3', userConfig.sfxVol);
            }
            setSettingsTo(elmnt.getAttribute('goto'));
        });
    });

    document.querySelectorAll('#setting-page .set-slider input').forEach(elmnt => {
        elmnt.addEventListener('mouseover', (event) => {
            playSFX('button-hover.mp3', userConfig.sfxVol);
        });
        elmnt.addEventListener('input', (event) => {
            if (elmnt.getAttribute('saveto') !== "undefined") {
                if (userConfig[elmnt.getAttribute('saveto')]) {
                    userConfig[elmnt.getAttribute('saveto')] = elmnt.value;
                    localStorage.setItem('wiidesk-demo-settings', JSON.stringify(userConfig));
                } else {
                    console.error(`slider event listener input: ${elmnt.getAttribute('saveto')} is not defined!`)
                }
            } else {
                console.log(`test slider:`, elmnt.value);
            }
        });
    });
};

function setSettingsTo(target) {
    target = target.toString();
    document.getElementById('setting-pages').innerHTML = getSettingHtml(target);
    initSettings();
};

function getSettingHtml(target) {
    target = target.toString();
    switch (target) {
        case "index":
            return `
            ${makeSettingPage([
                {title: "This is a Test Button", type: "button", goto: "test"},
                {title: "Change System Volume", type: "button", goto: "volume"},
                {title: "Format Wii System Memory", type: "button", goto: "format"},
            ])}

            <div id="setting-page" class="ver">
                <div class="content">
                    Website version&nbsp;<span id="versionprint">a</span><br>
                    WiiDesk latest available: <span id="updatedver"></span><br>
                    Based upon Wii System 4.3E
                </div>
            </div>
            `;

        case "test":
            return `
            ${makeSettingPage([
                {title: "This is a Test Menu", type: "text"},
                {title: "Return to Settings", type: "button", goto: "index", special: "back"},
                {title: "Test Slider (logged to console)", type: "slider", min: 0, max: 100, step: 1, value: 50},
            ])}
            `;

        case "volume":
            return `
            ${makeSettingPage([ 
                {title: "Sound Effects", type: "slider", min: 0, max: 1, step: 0.05, value: userConfig.sfxVol, saveto: "sfxVol"},
                {title: "Music", type: "slider", min: 0, max: 1, step: 0.05, value: userConfig.musicVol, saveto: "musicVol"},
                {title: "Return to Settings", type: "button", goto: "index", special: "back"},
            ])}
            `;

        case "format":
            return `
            ${makeSettingPage([
                {title: "You can't do this yet, please wait for the next update!!", type: "text"},
                {title: "Return to Settings", type: "button", goto: "index", special: "back"},
            ])}
            `;

    
        default:
            return `
            ${makeSettingPage([
                {title: "the page you're looking for doesn't exist.", type: "text"},
                {title: "Return to Settings", type: "button", goto: "index", special: "back"},
            ])}

            <div id="setting-page" class="ver">
                <div class="content">
                    Website version&nbsp;<span id="versionprint">a</span><br>
                    WiiDesk latest available: <span id="updatedver"></span><br>
                    Based upon Wii System 4.3E
                </div>
            </div>
            `;
    };
};

function makeSettingPage(params) {
    if (!Array.isArray(params)) {
        params = [params];
    }
    console.log(params);

    let html = "";
    params.forEach(param => {
        switch (param.type) {
            case "button":
                let special = '';
                if (param.special == "back") {
                    special = `special="back"`;
                }
                html += `<button class="set-btn" goto="${param.goto}" ${special}>${param.title}</button>`;
            break;

            case "slider":
                html += `
                <div class="set-slider">
                    <h3>${param.title}</h3>
                    <input type="range" min="${param.min}" max="${param.max}" step="${param.step}" value="${param.value}" saveto="${param.saveto}">
                </div>
                `;
            break;

            case "text":
                html += `${param.title}`;
            break;
        
            default:
            return console.error(`makeSettingPage: unknown type: ${param.type}`);
        }
    });

    return `
    <div id="setting-page">
        <div class="content">
            ${html}
        </div>
    </div>
    `;
}