const { nowInSec, SkyWayAuthToken, SkyWayContext, SkyWayRoom, SkyWayStreamFactory, uuidV4 } = skyway_room;


const token = new SkyWayAuthToken({
jti: uuidV4(),
iat: nowInSec(),
exp: nowInSec() + 60 * 60 * 24,
scope: {
    app: {
    id: "af466ae1-3762-476f-9fb6-11b8da001618",
    turn: true,
    actions: ['read'],
    channels: [
        {
        id: '*',
        name: '*',
        actions: ['write'],
        members: [
            {
            id: '*',
            name: '*',
            actions: ['write'],
            publication: {
                actions: ['write'],
            },
            subscription: {
                actions: ['write'],
            },
            },
        ],

        sfuBots: [
            {
            actions: ['write'],
            forwardings: [
                {
                actions: ['write'],
                },
            ],
            },
        ],
        },
    ],
    },
},
}).encode("TgUPJ9P/ceQBSBzSV5vmieIVHJ9jtjaScn9w29PrxAE=");

document.addEventListener('DOMContentLoaded', function() {
    const videoToggle = document.getElementById('videoToggle');
    const localVideo = document.getElementById('local-video');
    const status = document.getElementById('status');
    
    videoToggle.addEventListener('change', function() {
      if (this.checked) {
        localVideo.style.display = 'block';
        status.textContent = 'カメラ ON';
      } else {
        localVideo.style.display = 'none';
        status.textContent = 'カメラ OFF';
      }
    });
  });
 

(async () => {
const localVideo = document.getElementById('local-video');
const buttonArea = document.getElementById('button-area');
const remoteMediaArea = document.getElementById('remote-media-area');
const channelNameInput = document.getElementById('channel-name');

const dataStreamInput = document.getElementById('data-stream');

const myId = document.getElementById('my-id');
const joinButton = document.getElementById('join');
const writeButton = document.getElementById('write');

const { audio, video } =
    await SkyWayStreamFactory.createMicrophoneAudioAndCameraStream();
video.attach(localVideo);
await localVideo.play();

const data = await SkyWayStreamFactory.createDataStream();
writeButton.onclick = () => {
    data.write(dataStreamInput.value);
    dataStreamInput.value = '';
};

joinButton.onclick = async () => {
    if (channelNameInput.value === '') return;

    const context = await SkyWayContext.Create(token);
    const channel = await SkyWayRoom.FindOrCreate(context, {
    type: 'p2p',
    name: channelNameInput.value,
    });
    const me = await channel.join();

    myId.textContent = me.id;

    await me.publish(audio);
    await me.publish(video);
    await me.publish(data);

    const subscribeAndAttach = (publication) => {
    if (publication.publisher.id === me.id) return;

    const subscribeButton = document.createElement('button');
    subscribeButton.textContent = `${publication.publisher.id}: ${publication.contentType}`;
    buttonArea.appendChild(subscribeButton);

    subscribeButton.onclick = async () => {
        const { stream } = await me.subscribe(publication.id);

        switch (stream.contentType) {
        case 'video':
            {
            const elm = document.createElement('video');
            elm.playsInline = true;
            elm.autoplay = true;
            stream.attach(elm);
            remoteMediaArea.appendChild(elm);
            }
            break;
        case 'audio':
            {
            const elm = document.createElement('audio');
            elm.controls = true;
            elm.autoplay = true;
            stream.attach(elm);
            remoteMediaArea.appendChild(elm);
            }
            break;
        case 'data': {
            const elm = document.createElement('div');
            remoteMediaArea.appendChild(elm);
            elm.innerText = 'data\n';
            stream.onData.add((data) => {
            elm.innerText += data + '\n';
            });
        }
        }
    };
    };

    channel.publications.forEach(subscribeAndAttach);
    channel.onStreamPublished.add((e) => subscribeAndAttach(e.publication));
};
})();
