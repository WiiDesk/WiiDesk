var def_config = {
    musicVol: 0.5,
    sfxVol: 0.2,
}
if (typeof(Storage) !== "undefined") {
    if (!localStorage.getItem('wiidesk-demo-settings') && localStorage.getItem('wiidesk-demo-settings')) {
        localStorage.setItem('wiidesk-demo-settings', localStorage.getItem('wiidesk-demo-settings'));
    }
    if (!localStorage.getItem('wiidesk-demo-channels') && localStorage.getItem('wiidesk-demo-channels')) {
        localStorage.setItem('wiidesk-demo-channels', localStorage.getItem('wiidesk-demo-channels'));
    }
}
if (typeof(Storage) !== "undefined") {
    if (!localStorage.getItem('wiidesk-demo-settings')) {
        localStorage.setItem("wiidesk-demo-settings", JSON.stringify(def_config));
        location.reload();
    }
} else {
    alert('Local Storage is not support or disabled -- settings will not work!')
}
var userConfig = JSON.parse(localStorage.getItem('wiidesk-demo-settings'));
console.log("user config:", userConfig);
var def_channels = [
    {
        id: 'disc',
        title: 'Disc Channel',
        assets: 'assets/channels/',
        channelart: 'channelart/',
        disc: true
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
        channelart: 'channelart/',
        target: 'shop/index.html'
    },
    {
        id: 'news',
        title: 'News Channel',
        assets: 'assets/channels/',
        channelart: 'channelart/'
    }
]
localStorage.setItem("wiidesk-demo-channels", JSON.stringify(def_channels));
var userChannels = JSON.parse(localStorage.getItem('wiidesk-demo-channels'));
console.log("user channels: ", userChannels);
function resetConfig(confirm) {
    if (confirm == true) {
        localStorage.setItem("wiidesk-demo-settings", JSON.stringify(def_config));
        userConfig = JSON.parse(localStorage.getItem('wiidesk-demo-settings'));
        console.log("user config reset!:", userConfig);
    } else {
        console.error("loadDefaultConfig: MAKE SURE YOU'D LIKE TO DO THIS BY USING \"loadDefaultConfig(true)\". THERE'S NO TURNING BACK!!")
    }
}
function resetChannels(confirm) {
    if (confirm == true) {
        localStorage.setItem("wiidesk-demo-channels", JSON.stringify(def_channels));
        userChannels = JSON.parse(localStorage.getItem('wiidesk-demo-channels'));
        console.log("user channels reset! (reload page to see):", userChannels);
    } else {
        console.error("loadDefaultChannels: MAKE SURE YOU'D LIKE TO DO THIS BY USING ADDING \"true\" IN THE FUNCTION. THERE'S NO TURNING BACK!!")
    }
}