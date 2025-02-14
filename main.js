const { nowInSec, SkyWayAuthToken, SkyWayContext, SkyWayRoom, SkyWayStreamFactory, uuidV4 } = skyway_room;


// トークンの生成
const token = new SkyWayAuthToken({
  jti: uuidV4(),
  iat: nowInSec(),
  exp: nowInSec() + 60 * 60 * 24,
  scope: {
      app: {
      id: "af466ae1-3762-476f-9fb6-11b8da001618", // SkyWayのアプリケーションID
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
  }).encode("TgUPJ9P/ceQBSBzSV5vmieIVHJ9jtjaScn9w29PrxAE=");  // SkyWayのシークレットキー

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
const dataStreamInput = document.getElementById('data-stream');
const myId = document.getElementById('my-id');
const joinButton = document.getElementById('join');
const writeButton = document.getElementById('write');

const { audio, video } = await SkyWayStreamFactory.createMicrophoneAudioAndCameraStream();  // マイクとカメラのストリームを取得
video.attach(localVideo); // ローカルビデオにカメラのストリームをアタッチ
await localVideo.play();  // ローカルビデオを再生

const data = await SkyWayStreamFactory.createDataStream();
writeButton.onclick = () => {
    data.write(dataStreamInput.value);
    dataStreamInput.value = '';
};

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
    await me.publish(data);   // データストリームを公開
    
    const subscribeAndAttach = (publication) => { // 受信した（購読）時の処理
    if (publication.publisher.id === me.id) return; // 自分の発行したものは無視

      const subscribeButton = document.createElement('button'); // 購読ボタンを作成
      subscribeButton.id = `subscribe-button-${publication.id}`;
      subscribeButton.textContent = `${publication.publisher.id}: ${publication.contentType}`;
      
      buttonArea.appendChild(subscribeButton);

      subscribeButton.onclick = async () => { // 購読ボタンが押された時の処理
        const { stream } = await me.subscribe(publication.id);  // 購読

        switch (stream.contentType) {
          case 'video': // videoの場合
            {
            const elm = document.createElement('video');
            elm.playsInline = true;
            elm.autoplay = true;
            stream.attach(elm);
            remoteMediaArea.appendChild(elm);
            }
            break;
          case 'audio': // audioの場合
            {
            const elm = document.createElement('audio');
            elm.controls = true;
            elm.autoplay = true;
            stream.attach(elm);
            remoteMediaArea.appendChild(elm);
            }
            break;
          case 'data': {  // dataの場合
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

    room.publications.forEach(subscribeAndAttach);
    room.onStreamPublished.add((e) => subscribeAndAttach(e.publication));
  };
});
