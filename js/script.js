var electronIpc = null;
try { electronIpc = require('electron').ipcRenderer; } catch (e) {}
window.electronIpc = electronIpc;

function showDateTime() {
    var hourDiv = document.getElementById("hour");
    var dateDiv = document.getElementById("date");
    var dateDiary = document.getElementById("date2");

    var date = new Date();
    var dayList = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    var monthNames = ["1","2","3","4","5","6","7","8","9","10","11","12"];
    var dayName = dayList[date.getDay()];
    var monthName = monthNames[date.getMonth()];
    var today = `${dayName} ${date.getDate()}/${monthName}`;

    var hour = date.getHours();
    var min = date.getMinutes().toString().padStart(2, '0');
    var time = hour + ":" + min;

    hourDiv.innerText = `${time}`;
    dateDiv.innerText = `${today}`;
    dateDiary.innerText = `${today}`;
}

function startDateTime() {
    setInterval(showDateTime, 1000);
}

function disableSplash() {
    document.querySelector('.splash').style.opacity = '0';
}

function zip() {
    bgMusicToggle();
    playSFXMulti(userConfig.sfxVol, ['channel-open.mp3', 'button-select.mp3']);
}

function rm2() {
    playSFX('returntomenu.mp3', userConfig.sfxVol);
    setTimeout(() => {document.body.classList.add("fadeOut");}, 1000);
    setTimeout(() => {
        sessionStorage.setItem('wiidesk-skipwarn', 'true');
        location.reload();
    }, 1500);
}

function settingsIn() {
    playSFX('sidemenu.mp3', userConfig.sfxVol);
    setTimeout(() => {document.body.classList.add("fadeOut");}, 0);
    setTimeout(() => {window.location.href = "./settings";}, 1000);
}

function startup(params) {

    document.querySelector('.splash .warning').removeEventListener('click', startup, true)

    if (params == 'skipwarn') {
        setTimeout(() => {
            document.querySelector('.welcomeback').classList.remove('disabled');
            document.querySelector('.warning').classList.add('disabled');
        }, 10);

    } else {

        playSFX('button-select.mp3', userConfig.sfxVol);
        document.querySelector('.splash').style.opacity = '0';
    }

    setTimeout(() => {

        document.querySelector('.splash').classList.add('disabled');
        document.querySelector('.main-menu').classList.remove('disabled');

        document.querySelector('.main-menu').style = 'animation: fadeIn .5s;';

        playSFX('startup.mp3', userConfig.musicVol);
        bgMusicToggle();

        setTimeout(() => {
            document.querySelector('.main-menu').style = '';
        }, 500);
    }, 3000);
}

function ifPWA() {
    return window.matchMedia("(display-mode: standalone)").matches;
}

window.addEventListener('load', () => {

    $(document).on('mouseenter', '.ch.occupied', function() {
        var vwoopTimeout = setTimeout(() => {
            playSFX('vwoop.mp3', userConfig.sfxVol);
        }, 500);
        $(this).data('vwoopTimeout', vwoopTimeout);
    });
    $(document).on('mouseleave', '.ch.occupied', function() {
        clearTimeout($(this).data('vwoopTimeout'));
    });

    $(document).on('mouseenter', '.wii-btn, .diary-btn', function() {
        playSFX('button-hover.mp3', userConfig.sfxVol);
        var vwoopTimeout = setTimeout(() => {
            playSFX('vwoop.mp3', userConfig.sfxVol);
        }, 500);
        $(this).data('vwoopTimeout', vwoopTimeout);
    });
    $(document).on('mouseleave', '.wii-btn, .diary-btn', function() {
        clearTimeout($(this).data('vwoopTimeout'));
    });

    document.querySelector('.main-menu').addEventListener('mouseover', (e) => {
        if (e.target.closest('.ch.occupied') && !e.target.closest('.ch.occupied').hasAttribute('data-hovered')) {
            e.target.closest('.ch.occupied').setAttribute('data-hovered', 'true');
            playSFX('button-hover.mp3', userConfig.sfxVol);
            setTimeout(() => {
                e.target.closest('.ch.occupied').removeAttribute('data-hovered');
            }, 200);
        }
    });
});