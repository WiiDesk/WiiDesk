
// What the "Yes" button of the confirmation dialog does (return to menu or log out)
var pendingAction = null;

function confirmYes() {
    if (pendingAction) pendingAction();
}

function openConfirmDialog(text, action) {
    document.getElementById('confirmText').innerHTML = text;
    document.getElementById('confirmYes').textContent = 'Yes';
    $(".returndialog").removeClass("single");
    pendingAction = action;
    $(".returndialog").css("display", "flex");
    playSFX('button-select-big.mp3', userConfig.sfxVol);
}

// Message with a single OK button
function openMessageDialog(text) {
    openConfirmDialog(text, function () { $(".returndialog").css("display", "none"); });
    document.getElementById('confirmYes').textContent = 'OK';
    $(".returndialog").addClass("single");
}

window.addEventListener("load", () => {
    document.body.insertAdjacentHTML("beforeend", `
        <div class="home-menu">
            <div class="bar-top close-pause-menu">
                <span>HOME Menu</span>
                <img src="assets/home-close.png" />
            </div>
            <div class="in-between">
                <a class="buttonlike backtomenu" onmouseenter="playSFX('button-hover.mp3', userConfig.sfxVol)">Wii Menu</a>
                <a class="buttonlike power-btn" onmouseenter="playSFX('button-hover.mp3', userConfig.sfxVol)">Shutdown Options</a>
            </div>
            <div class="bar-bottom">
                <img src="assets/remote.png" class="remote" />
                <div>
                    <div class="battery">
                        <div>
                            <span>P1</span>
                            <img src="assets/power-full.png" />
                        </div>
                        <div>
                            <span>P2</span>
                            <img src="assets/power-empty.png" />
                        </div>
                        <div>
                            <span>P3</span>
                            <img src="assets/power-empty.png" />
                        </div>
                        <div>
                            <span>P4</span>
                            <img src="assets/power-empty.png" />
                        </div>
                    </div>
                    <div class="text">Wii Remote Settings</div>
                </div>
            </div>
        </div>
        <div class="authdialog">
            <div class="msgbox">
                <div class="text" id="authText"></div>
                <div class="authprompt" id="authPrompt"></div>
                <input type="password" id="authInput" autocomplete="off" spellcheck="false" />
                <div class="authhint" id="authHint"></div>
                <div class="actions">
                    <a id="authOk" onmouseenter="playSFX('button-hover.mp3', userConfig.sfxVol)">OK</a>
                    <a id="authCancel" onmouseenter="playSFX('button-hover.mp3', userConfig.sfxVol)">Cancel</a>
                </div>
            </div>
        </div>
        <div class="powerdialog">
            <div class="msgbox">
                <div class="text">Shutdown Options</div>
                <div class="actions">
                    <a data-power="logout" onmouseenter="playSFX('button-hover.mp3', userConfig.sfxVol)">Log Out</a>
                    <a data-power="reboot" onmouseenter="playSFX('button-hover.mp3', userConfig.sfxVol)">Restart</a>
                    <a data-power="poweroff" onmouseenter="playSFX('button-hover.mp3', userConfig.sfxVol)">Shut Down</a>
                    <a data-power="suspend" onmouseenter="playSFX('button-hover.mp3', userConfig.sfxVol)">Sleep</a>
                    <a class="cancel" onmouseenter="playSFX('button-hover.mp3', userConfig.sfxVol)">Cancel</a>
                </div>
            </div>
        </div>
        <div class="returndialog">
            <div class="msgbox">
                <div class="text" id="confirmText">
                    Return to the Wii Menu?<br>
                    (Anything not saved will be lost.)
                </div>
                <div class="actions">
                    <a id="confirmYes" onclick="confirmYes();" onmouseenter="playSFX('button-hover.mp3', userConfig.sfxVol)">Yes</a>
                    <a class="closedialog" onmouseenter="playSFX('button-hover.mp3', userConfig.sfxVol)" onclick="playSFX('button-cancel.mp3', userConfig.sfxVol)">No</a>
                </div>
            </div>
        </div>
    `);

    var lastBgMusicState;
    // True when the Home key opened the menu on top of another app
    var openedOverApp = false;

    function openHomeMenu() {
        lastBgMusicState = getBGMusicState();

        if (getBGMusicState().intro) bgMusicIntroToggle();

        if (getBGMusicState().main) bgMusicToggle();
        playSFX('home-in.mp3', userConfig.sfxVol);
        $(".home-menu").css("display", "grid");
        $('.home-menu')[0].ariaLabel = 'on';
    }

    function closeHomeMenu() {
        $(".home-menu").addClass("fadeOut");
        setTimeout(() => {
            $(".home-menu").css("display", "none");
            $(".home-menu").removeClass("fadeOut");
        }, 250);
        playSFX('button-cancel.mp3', userConfig.sfxVol);

        if (lastBgMusicState && lastBgMusicState.intro) bgMusicIntroToggle();

        if (lastBgMusicState && lastBgMusicState.main) bgMusicToggle();
        $('.home-menu')[0].ariaLabel = null;

        // Desktop app: go back to the app the menu was opened over
        if (window.electronIpc) window.electronIpc.invoke('home-closed', openedOverApp);
        openedOverApp = false;
    }

    function toggleHomeMenu() {
        if ($('.home-menu')[0].ariaLabel !== 'on') openHomeMenu();
        else closeHomeMenu();
    }

    document.addEventListener('keydown', function(e) {
        if (e.keyCode === 27 || e.key === 'Escape') {
            e.preventDefault();
            if (authId !== null) return;
            if ($(".powerdialog").css("display") !== "none") { closePowerDialog(); return; }
            toggleHomeMenu();
        }
    });

    // --- Password dialog for system requests (polkit), driven by main.js ---
    var authId = null;
    // Set while the dialog asks for something locally (e.g. a Wi-Fi password) instead of for polkit
    var localAsk = null;

    // askPassword(title, prompt, callback): callback(text) on OK, nothing happens on cancel
    window.askPassword = function (title, prompt, callback) {
        if (authId !== null) return;
        authId = 'local';
        localAsk = callback;
        var input = document.getElementById('authInput');
        document.getElementById('authText').textContent = title;
        document.getElementById('authPrompt').textContent = prompt;
        authSetHint('');
        input.type = 'password';
        input.value = '';
        input.disabled = false;
        $(".authdialog").css("display", "flex");
        playSFX('alert.mp3', userConfig.sfxVol);
        input.focus();
    };

    function authClose() {
        authId = null;
        localAsk = null;
        document.getElementById('authInput').value = '';
        $(".authdialog").css("display", "none");
    }

    function authSend(message) {
        window.electronIpc.send('polkit-reply', message);
    }

    function authSubmit() {
        var input = document.getElementById('authInput');
        if (authId === null || input.disabled) return;
        playSFX('button-select.mp3', userConfig.sfxVol);
        if (localAsk) {
            var cb = localAsk, text = input.value;
            authClose();
            cb(text);
            return;
        }
        authSend({ type: 'response', id: authId, text: input.value });
        input.value = '';
        input.disabled = true;
        document.getElementById('authHint').textContent = '';
    }

    function authCancel() {
        if (authId === null) return;
        playSFX('button-cancel.mp3', userConfig.sfxVol);
        if (!localAsk) authSend({ type: 'cancel', id: authId });
        authClose();
    }

    function authSetHint(text, isError) {
        var hint = document.getElementById('authHint');
        hint.textContent = text;
        hint.classList.toggle('error', !!isError);
    }

    if (window.electronIpc) {
        window.electronIpc.on('polkit', function(event, msg) {
            var input = document.getElementById('authInput');
            if (msg.type === 'begin') {
                authId = msg.id;
                document.getElementById('authText').textContent = msg.message;
                document.getElementById('authPrompt').textContent = '';
                authSetHint('');
                input.value = '';
                input.disabled = true;
                $(".authdialog").css("display", "flex");
                playSFX('alert.mp3', userConfig.sfxVol);
            } else if (msg.id !== authId) {
                return;
            } else if (msg.type === 'prompt') {
                document.getElementById('authPrompt').textContent = msg.text.replace(/[:\s]+$/, '');
                input.type = msg.echo ? 'text' : 'password';
                input.disabled = false;
                input.value = '';
                input.focus();
            } else if (msg.type === 'info') {
                authSetHint(msg.text, false);
            } else if (msg.type === 'error') {
                authSetHint(msg.text, true);
            } else if (msg.type === 'done' || msg.type === 'cancel') {
                authClose();
            }
        });

        $("#authOk").click(authSubmit);
        $("#authCancel").click(authCancel);
        document.getElementById('authInput').addEventListener('keydown', function(e) {
            if (e.key === 'Enter') { e.preventDefault(); authSubmit(); }
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); authCancel(); }
        });
    }

    // Home key (Super), forwarded by the desktop session
    if (window.electronIpc) {
        window.electronIpc.on('home-button', function(event, overApp) {
            if ($('.home-menu')[0].ariaLabel !== 'on') openedOverApp = !!overApp;
            toggleHomeMenu();
        });
    }

    $(".close-pause-menu").click(closeHomeMenu);

    $(".backtomenu").click(event => {
        openConfirmDialog('Return to the Wii Menu?<br>(Anything not saved will be lost.)', rm2);
    });

    // Log out / restart / shut down / sleep only make sense inside the desktop app
    if (!window.electronIpc) $(".power-btn").hide();

    function closePowerDialog() {
        $(".powerdialog").css("display", "none");
    }

    $(".power-btn").click(function () {
        $(".powerdialog").css("display", "flex");
        playSFX('button-select-big.mp3', userConfig.sfxVol);
    });

    $(".powerdialog .cancel").click(function () {
        playSFX('button-cancel.mp3', userConfig.sfxVol);
        closePowerDialog();
    });

    $(".powerdialog [data-power]").click(function () {
        var kind = this.getAttribute('data-power');
        closePowerDialog();
        if (kind === 'logout') logOut();
        else powerAction(kind);
    });

    $(".closedialog").click(event => {
        $(".returndialog").css("display", "none");
    });
});