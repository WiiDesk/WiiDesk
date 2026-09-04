var userConfig = JSON.parse(localStorage.getItem('wiidesk-demo-settings'));

var bgMusicAudio = new Audio('audio/bg-music.mp3');
bgMusicAudio.loop = true;
bgMusicAudio.volume = userConfig ? userConfig.musicVol : 0.5;

var introBgMusic;

function setBGMusic(fileLocation, introLocation) {
    bgMusicAudio = new Audio(fileLocation);
    bgMusicAudio.loop = true;
    bgMusicAudio.volume = userConfig ? userConfig.musicVol : 0.5;

    if (introLocation) {
        introBgMusic = new Audio(introLocation);
        introBgMusic.volume = userConfig ? userConfig.musicVol : 0.5;
        introBgMusic.play();

        introBgMusic.addEventListener('ended', () => {
            bgMusicToggle(true);
        });
    }
}

function bgMusicToggle(forceToggle) {
    if (forceToggle !== undefined) {
        if (forceToggle == false) {
            bgMusicAudio.pause();
        } else if (forceToggle == true) {
            bgMusicAudio.play().catch(e => console.log('BG music play failed:', e));
        }
    } else if (!bgMusicAudio.paused) {
        bgMusicAudio.pause();
    } else if (bgMusicAudio.paused) {
        bgMusicAudio.play().catch(e => console.log('BG music play failed:', e));
    }
}

function bgMusicIntroToggle(forceToggle) {
    if (!introBgMusic) return;
    
    if (forceToggle !== undefined) {
        if (forceToggle == false) {
            introBgMusic.pause();
        } else if (forceToggle == true) {
            introBgMusic.play().catch(e => console.log('Intro music play failed:', e));
        }
    } else if (!introBgMusic.paused) {
        introBgMusic.pause();
    } else if (introBgMusic.paused) {
        introBgMusic.play().catch(e => console.log('Intro music play failed:', e));
    }
}

function getBGMusicState() {
    return {
        intro: introBgMusic ? !introBgMusic.paused : false,
        main: !bgMusicAudio.paused
    };
}

function playMusic(name, vol, loop) {
    if (!bgMusicAudio.paused) {
        bgMusicAudio.pause();
    }
    if (!name) return alert('You must provide a file name from the "audio/" dir.!');
    if (!vol) return alert('You must provide a volume value!');
    
    var music = new Audio('audio/' + name);
    music.volume = vol;
    music.loop = loop ? true : false;
    music.play().catch(e => console.log('Music play failed:', e));
}

function playSFX(name, vol) {
    if (!name) return console.log('playSFX: No file name provided');
    if (vol === undefined) vol = 0.5;
    
    var sfx = new Audio('audio/' + name);
    sfx.volume = vol;
    sfx.play().catch(e => console.log('SFX play failed:', name, e));
}

function playSFXMulti(vol, names) {
    if (Array.isArray(names)) {
        names.forEach(name => {
            var sfx = new Audio('audio/' + name);
            sfx.volume = vol;
            sfx.play().catch(e => console.log('Multi-SFX play failed:', name, e));
        });
    } else {
        alert('playSFXMulti: Your files must in a array!')
    }
}