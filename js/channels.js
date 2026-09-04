function addChannel(id, title, assets, channelart, target, videoformat) {
    function def_cmd() {
        console.log(`Defaults: addChannel('id', 'Title', 'path-to-assets[/]', 'path-to-channelart[/]', [optional: 'target-to-html', 'video-format (recommend webp!)'] )`);
    }
    function logErr(msg, defcmd) {
        if (defcmd == true) def_cmd();
        console.error(`addChannel: ${msg}`);
        return { err: true, msg: msg };
    }
    if (!id) {
        let msg = `You must supply a id!`;
        return logErr(msg, true);
    } else if (userChannels.find((element) => element.id === id)) {
        let msg = `You already have a channel with that id!`;
        return logErr(msg);
    } else if (!title) {
        let msg = `You must supply a title!`;
        return logErr(msg, true);
    } else if (!assets) {
        let msg = `You must supply the assets directory! (Don't include the id with this var)`;
        return logErr(msg, true);
    } else if (!assets.endsWith('/')) {
        let msg = `Your assets folder doesn't end with a "/"! Please fix that!`;
        return logErr(msg, true);
    } else if (!channelart) {
        let msg = `You must supply the channelart directory! (Don't include the id with this var)`;
        return logErr(msg, true);
    } else if (!channelart.endsWith('/')) {
        let msg = `Your channelart folder doesn't end with a "/"! Please fix that!`;
        return logErr(msg, true);
    } else {
        var channel = {
            id: id,
            title: title,
            assets: assets,
            channelart: channelart
        }
        if (target) {
            channel.target = target;
        }
        if (videoformat) {
            channel.videoformat = videoformat;
        }
        
        userChannels.push(channel);
        localStorage.setItem("wiidesk-demo-channels", JSON.stringify(userChannels));
        console.log(`new channel storage: `, userChannels);
        return 'Please reload this page to see your new channel!';
    }
}

function makeChannel(channeljson) {
    var target = document.getElementsByClassName('ch blank')[0];

    target.classList.remove('blank');
    target.classList.add('occupied');

    target.setAttribute('data-id' , channeljson.id);
    if (channeljson.target) {
        target.setAttribute('data-href', channeljson.target)
    }
    hasDisc = '';
    if (channeljson.disc == true) {
        hasDisc = 'id="discTag"';

        target.insertAdjacentHTML(`afterbegin`,
        
        `
        <img src="channelart/disc/disc.png" class="spinnin" />
        `
        )
    }
    var artHtml;
    if (channeljson.customArt) {
        var icon = channeljson.customArt.icon
            ? `<img src="${channeljson.customArt.icon}" class="custom-art-icon" />`
            : `<span class="custom-art-initial">${(channeljson.title || '?').charAt(0).toUpperCase()}</span>`;
        artHtml = `<div class="custom-art">${icon}</div>`;
    } else {
        artHtml = `<iframe src="${channeljson.channelart}${channeljson.id}/channel.html"></iframe>`;
    }

    target.insertAdjacentHTML('afterbegin', 
    
    `
    ${artHtml}
    <div class="onhover" onmouseover="playSFX('button-hover.mp3', 0.2)" onclick="zip()"></div>
    <span class="tag" ${hasDisc}>${channeljson.title}</span>
    `
    )
}

function removeChannel(id) {
    var channel = userChannels.findIndex((element) => element.id === id);

    if (!channel) {
        console.error('removeChannel: Couldn\'t find a channel with that id!');
    }

    var targetDiv = $(`[data-id="${id}"]`)[0];
    targetDiv.classList.remove('occupied');
    while (targetDiv.firstChild) {
        targetDiv.removeChild(targetDiv.firstChild);
    }
    targetDiv.classList.add('blank');
    targetDiv.parentNode.appendChild(targetDiv);

    userChannels.splice(channel, 1)
    console.log(`removed channel '${id}': `, userChannels);
    localStorage.setItem("wiidesk-demo-channels", JSON.stringify(userChannels));
}