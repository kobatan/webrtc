const { nowInSec, SkyWayAuthToken, SkyWayContext, SkyWayRoom, SkyWayStreamFactory, uuidV4 } = skyway_room;


// トークンの生成
const token = new SkyWayAuthToken({
  jti: uuidV4(),
  iat: nowInSec(),
  exp: nowInSec() + 60 * 60 * 24,
  version: 3,
  scope: {
    appId: "af466ae1-3762-476f-9fb6-11b8da001618",
    rooms: [
      {
        name: "*",
        methods: ["create", "close", "updateMetadata"],
        member: {
          name: "*",
          methods: ["publish", "subscribe", "updateMetadata"],
        },
      },
    ],
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
const roomNameInput = document.getElementById('room-name');
const myId = document.getElementById('my-id');
const joinButton = document.getElementById('join');

const { audio, video } = await SkyWayStreamFactory.createMicrophoneAudioAndCameraStream();  // マイクとカメラのストリームを取得
video.attach(localVideo); // ローカルビデオにカメラのストリームをアタッチ
await localVideo.play();  // ローカルビデオを再生

joinButton.onclick = async () => {
    if (roomNameInput.value === '') return;

    const context = await SkyWayContext.Create(token);  // 先ほど作ったトークンからSkyWayのコンテキストを作成
    const room = await SkyWayRoom.FindOrCreate(context, {  // ルームが無ければ作成、あれば取得
      type: 'p2p',
      name: roomNameInput.value,
    });
    const me = await room.join();  // room に入室します。 すると Member オブジェクトが返ってきます。ここでは me という変数名とします。
    myId.textContent = me.id; // 自分のIDを表示

    await me.publish(audio);  // マイクのストリームを公開
    await me.publish(video);  // カメラのストリームを公開
    
    const subscribeAndAttach = (publication) => { // 受信した（購読）時の処理
    if (publication.publisher.id === me.id) return; // 自分の発行したものは無視

      const subscribeButton = document.createElement('button'); // 購読ボタンを作成
      subscribeButton.id = `subscribe-button-${publication.id}`;
      subscribeButton.textContent = `${publication.publisher.id}: ${publication.contentType}`;
      
      buttonArea.appendChild(subscribeButton);  // ボタン追加

      subscribeButton.onclick = async () => { // 購読ボタンが押された時の処理
        const { stream } = await me.subscribe(publication.id);  // 購読
        let newMedia;
        switch (stream.track.kind) {
          case "video":
            newMedia = document.createElement("video");
            newMedia.playsInline = true;
            newMedia.autoplay = true;
            break;
          case "audio":
            newMedia = document.createElement("audio");
            newMedia.controls = true;
            newMedia.autoplay = true;
            break;
          default:
            return;
        }
        newMedia.id = `media-${publication.id}`;
        stream.attach(newMedia);
        remoteMediaArea.appendChild(newMedia);
      };
    };

    room.publications.forEach(subscribeAndAttach);  // 購読したものを公開する
    room.onStreamPublished.add((e) => subscribeAndAttach(e.publication)); // 公開した時の処理を追加
  };
});
