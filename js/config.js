function isVideoSrc(src) {
    return typeof src === 'string' && (src.indexOf('data:video/') === 0 || /\.(mp4|webm)(\?|$)/i.test(src));
}

function mediaTag(src, cls, autoplay) {
    if (autoplay === undefined) autoplay = true;
    if (isVideoSrc(src)) {
        return '<video src="' + src + '" class="' + (cls || '') + '"' + (autoplay ? ' autoplay' : '') + ' muted loop playsinline></video>';
    }
    return '<img src="' + src + '" class="' + (cls || '') + '" />';
}

var def_config = {
    musicVol: 0.5,
    sfxVol: 0.2,
}

function cloneDefaults(obj) {
    return JSON.parse(JSON.stringify(obj));
}

var userConfig = WiiDeskStorage.load('wiidesk-settings', null);
if (!userConfig) {
    userConfig = cloneDefaults(def_config);
    WiiDeskStorage.save('wiidesk-settings', userConfig);
}
console.log("user config:", userConfig);

function applyTheme(name) {
    if (name === 'dark') {
        document.documentElement.classList.add('dark-theme');
    } else {
        document.documentElement.classList.remove('dark-theme');
    }
    localStorage.setItem('wiidesk-theme', name);
    refreshThemeImages(name);
}

function refreshThemeImages(name) {
    var dark = name === 'dark';
    var wiiBtn = document.querySelector('.wii-btn');
    var mailBtn = document.querySelector('.diary-btn');
    if (wiiBtn) wiiBtn.src = dark ? 'assets/dark-wii-button.png' : 'assets/wii-button.png';
    if (mailBtn) mailBtn.src = dark ? 'assets/dark-mail-button.png' : 'assets/mail-button.png';

    document.querySelectorAll('.left-btn').forEach(function(el) {
        el.src = dark ? 'assets/dark-left-button.png' : 'assets/left-button.png';
    });
    document.querySelectorAll('.right-btn').forEach(function(el) {
        el.src = dark ? 'assets/dark-right-button.png' : 'assets/right-button.png';
    });

    var backToMenu = document.querySelector('.backtowiimenu');
    if (backToMenu) backToMenu.src = dark ? 'assets/dark-backtomenu.png' : 'assets/backtomenu.png';
}

applyTheme(localStorage.getItem('wiidesk-theme') || 'light');
document.addEventListener('DOMContentLoaded', function() {
    refreshThemeImages(localStorage.getItem('wiidesk-theme') || 'light');
});

var def_channels = [
    {
        id: 'disc',
        title: 'Disc Channel',
        assets: 'assets/channels/',
        channelart: 'channelart/',
        disc: true,
        target: 'C:\\Windows\\explorer.exe',
        isAppLauncher: true
    },
    {
        id: 'mii',
        title: 'Mii Channel',
        assets: 'assets/channels/',
        channelart: 'channelart/'
    },
    {
        id: 'photo',
        title: 'Photo Channel',
        assets: 'assets/channels/',
        channelart: 'channelart/'
    },
    {
        id: 'shop',
        title: 'Wii Shop Channel',
        assets: 'assets/channels/',
        channelart: 'channelart/'
    },
    {
        id: 'news',
        title: 'News Channel',
        assets: 'assets/channels/',
        channelart: 'channelart/'
    }
]

var existingChannels = WiiDeskStorage.load('wiidesk-channels', null);
if (!existingChannels) {
    console.log('No channels found, loading defaults...');
    WiiDeskStorage.save('wiidesk-channels', def_channels);
    existingChannels = cloneDefaults(def_channels);
} else {
    var existingIds = existingChannels.map(function (ch) { return ch.id; });
    var healedChannels = existingChannels.filter(function (ch) {
        return ch.id !== 'bottomgear' && ch.id !== 'onliine';
    });
    def_channels.forEach(function (defCh) {
        if (existingIds.indexOf(defCh.id) === -1) {
            healedChannels.push(cloneDefaults(defCh));
        }
    });
    if (healedChannels.length !== existingChannels.length) {
        console.log('Restoring missing channels:', healedChannels.length - existingChannels.length);
        WiiDeskStorage.save('wiidesk-channels', healedChannels);
        existingChannels = healedChannels;
    }
}
var userChannels = existingChannels;
console.log("user channels: ", userChannels);

function resetConfig(confirm) {
    if (confirm == true) {

        WiiDeskStorage.save('wiidesk-settings', def_config);
        userConfig = cloneDefaults(def_config);
        console.log("user config reset!:", userConfig);
    } else {
        console.error("loadDefaultConfig: MAKE SURE YOU'D LIKE TO DO THIS BY USING \"loadDefaultConfig(true)\". THERE'S NO TURNING BACK!!")
    }
}

function resetChannels(confirm) {
    if (confirm == true) {

        WiiDeskStorage.save('wiidesk-channels', def_channels);
        userChannels = cloneDefaults(def_channels);
        console.log("user channels reset! (reload page to see):", userChannels);
    } else {
        console.error("loadDefaultChannels: MAKE SURE YOU'D LIKE TO DO THIS BY ADDING \"true\" IN THE FUNCTION. THERE'S NO TURNING BACK!!")
    }
}