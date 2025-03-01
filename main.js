  let localVideo = document.getElementById('local_video');
  let remoteVideo = document.getElementById('remote_video');
  let textForSendSdp = document.getElementById('text_for_send_sdp');
  let textToReceiveSdp = document.getElementById('text_for_receive_sdp');

  let localStream = null;     // P2P通信で使用する
  let peerConnection = null;  // peer接続済みフラグ
 
  //===================== media handling ======================= 
  function getDeviceStream(option) {
    if ('getUserMedia' in navigator.mediaDevices) {
      console.log('HTML: navigator.mediaDevices.getUserMadia');
      return navigator.mediaDevices.getUserMedia(option);
    }else{
      console.log('HTML: wrap navigator.getUserMadia with Promise');
      return new Promise(function(resolve, reject){    
        navigator.getUserMedia(option, resolve, reject);
      });      
    }
  }
  
  function startLocalVideo(){  // start local video
    getDeviceStream({video: true, audio: true})  // ローカルビデオを取得する（video:ON audio:ON）
    .then(function (stream) {                     // 成功したら
      localStream = stream;                       // ストリーム変数に代入（P2Pでの送信用）
      playVideo(localVideo, stream);              // HTMLのvideoに再生      
      console.log('HTML: playVideo() for Local');     
    }).catch(function (error) { // error
      console.error('HTML: getUserMedia error:', error);
      return;
    });
  }

  function playVideo(element, stream) { // HTMLのvideoに再生
    if ('srcObject' in element) {
      console.log('HTML: elemet.srcObject = stream;');
      if(element.srcObject === null)
        element.srcObject = stream;
    }else{
      console.log('HTML: element.src = window.URL.createObjectURL(stream);');
      element.src = window.URL.createObjectURL(stream);
    }
    element.volume = 1; // 0 or 1
    element.play();
  }

  // stop local video
  function stopLocalVideo() {
    pauseVideo(localVideo);           // HTMLのvideoを停止
    stopLocalStream(localStream);     // ストーリームを停止
  }

  function pauseVideo(element) {
    element.pause();
    if ('srcObject' in element) {
      element.srcObject = null;
    }else{
      if (element.src && (element.src !== '') ) {
        window.URL.revokeObjectURL(element.src);
      }
      element.src = '';
    }
  }

  function stopLocalStream(stream) {  // ローカルストリームを停止
    let tracks = stream.getTracks();
    if (! tracks) {
      console.warn('NO tracks');
    }else{
      for (let track of tracks) {
        track.stop();
      }
    }
  }

// =============== EMQX MQTTブローカー に接続 =============================
// MQTT 接続情報
  const TCP_port = 1883;
  const WS_port =  8083;
  const SSL_port = 8883;
  const WSS_port = 8084;
// const API_KEY = 'https://ebb8eeee.ala.asia-southeast1.emqxsl.com:8443/api/v5';
// const KEY = fs.readFileSync(path.join(__dirname, '/tls-key.pem'));
// const CERT = fs.readFileSync(path.join(__dirname, '/tls-cert.pem'));
  const TRUSTED_CA_LIST = './emqxsl-ca.crt';
//  const border = 'broker.emqx.io';
  const Broker = 'ebb8eeee.ala.asia-southeast1.emqxsl.com';
  const User_name = "user"; 
  const Password = "password";  
  const Host = 'wss://' + Broker + ':' + WSS_port +'/mqtt'; // MQTTブローカー
  const topic_offer = User_name + '/signaling/offer';       // MQTT用のトピック名を決めて置く
  const topic_answer = User_name + '/signaling/answer';
  const topic_candidate = User_name + '/signaling/candidate';
  
  var clientId = 'mqttjs_' + Math.random().toString(16).substr(2, 8); // 他の人と被らないクライアントIDを作成。

  const options = {  // Create an MQTT client instance
    keepalive:60,
    clientId: clientId,
    protocolId:'MQTT',
    protocolVersion: 4,
    username: User_name,
    password: Password,
    clean: true,
    reconnectPeriod: 1000,
    connectTimeout: 30*1000,
//    key: KEY,
//    cert: CERT,
//    rejectUnauthorized: true,
    ca: TRUSTED_CA_LIST,    // CA証明書
  }
  console.log('MQTT: Connecting MQTT Client ...');

  const client  = mqtt.connect(Host, options); // MQTT（シグナリングサーバー）に接続する

  function buildTopic(type) {   // topic名をその都度作成
    var topic = User_name + '/signaling/' + type;
    return topic;
  }

  client.on('connect', function () {  // MQTTに接続出来たら
    console.log('MQTT: Connected');
    subscribe('offer');               // offerを待ち受ける。(subscribe=購読する)
  })

  client.on('message', function(topic, message, packet){  // MQTT にメッセージが来たら呼ばれる
    status.textContent = 'MQTT message recived';
    console.log(`MQTT: onmessage ==> Topic: ${topic}, QoS: ${packet.qos}`);
    switch(topic){
      case topic_offer:   // "offer"トピックが来たら
        console.log('MQTT: Received Offer SDP ...');
        textToReceiveSdp.value = message;   // 受信テキストBOXに表示
        setOfferText(message);              // 新たなpeer接続を作り。 相手のSDPをセットする
        makeAnswer();                       // 自分のSDPをanswerにセットする
        break;
      case topic_answer:  // "anser"トピックが来たら
        console.log('MQTT: Received Answer SDP ...');
        textToReceiveSdp.value = message;   // 受信テキストBOXに表示
        setAnswerText(message);             // 相手SDPをpeerにセットする
        break;
      case topic_candidate:                 // ICE candidateが来たら
        console.log('MQTT: Received ICE candidate ...');
        let candidate = new RTCIceCandidate(message);
        console.log(candidate);
        addIceCandidate(candidate);         // 覚えさせる
        break;
      default:
        console.warn('MQTT: Bad SDP topic');
    }
  })
  
  client.on('reconnect', function () {  // 切断後に再接続でトリガ
    status.textContent = 'MQTT Reconnect';   
    console.log('MQTT: Reconnecting...');
  })

  client.on('close', function () {      // 切断後にトリガ
    status.textContent = 'MQTT close';
    console.log('MQTT: Disconnected')
  })

  function subscribe(type) {      // 購読予約する
    var topic = buildTopic(type); // topic名を生成
    client.subscribe(topic);      // topic名で購読予約する
    console.log('MQTT: Subscribe topic = ' + topic);
  }

  function unsubscribe(type) {    // 購読予約を解除する
    var topic = buildTopic(type); // topic名を生成
    client.unsubscribe(topic);    // topic名の予約を解除する
    console.log('MQTT: unSubscribe topic = ' + topic);    
  }

  function publish(type, text){   // 投稿する
   var topic = buildTopic(type);  // topic名を決める
   client.publish(topic, text);   // topic名で投稿する
   console.log('MQTT: Publish topic = ' + topic);
  }

//======= PeerConnection ================================================
  function connect() {
    if (! peerConnection) { // まだコネクションが確立してなかったら
      console.log('Peer: Peer接続を開始します ...');
      startPeer();          //  Offer SDPを作成し送信する。（非同期処理）
    }else{
      console.warn('Peer: already exist.');
    }
  }

  function startPeer() {    // Peer接続を開始する
    unsubscribe("offer");   // offerの待ち受けを解除
    subscribe("answer");    // answerを待ち受ける
    peerConnection = prepareNewConnection();  // RTCPeerConnectionを生成し、必要なメッセージハンドラを設定

    peerConnection.createOffer()              // OfferSDPを生成 （非同期で処理が行われるので、.then()で受け止める。Promise）
      .then(function (offerSDP) {
        console.log('Peer: ローカルSDP作成成功。PeerにローカルSDPに追加します。 type : ' + offerSDP.type);  // [2]
        return peerConnection.setLocalDescription(offerSDP);  // 生成したOffer SDPを、ローカルSDPに登録。（非同期で処理が行われるので、.then()で受け止める。Promise）
      }).then(function() {                                    // 裏でICE Candidatesが作成される。このタイミングで自身のonicecandidateが発火される。
        console.log('Peer: PeerにローカルSDP追加成功');
        // Vanilla ICE の場合には、まだSDPは送らない 
        // Trickle Ice の場合ここで置くる
        // sendSdp(peerConnection.localDescription);   // ローカルSDPを相手に送る。(Trickle ICE 処理)
      }).catch(function(err) {  // エラー
        console.error(err);
      });

  }
  
  function makeAnswer() { // Anser SDP を作成し送信する
    console.log('Peer: sending Answer. Creating remote session description...' );
    if (! peerConnection) {
      console.error('Peer: peerConnection NOT exist!');
      return;
    }
    
    peerConnection.createAnswer() //  Answer SDPを生成(非同期処理)
      .then(function (sessionDescription) {
        console.log('Peer: createAnswer() succsess in promise');
        return peerConnection.setLocalDescription(sessionDescription);  // 生成したAnswer SDPをローカルSDPにする。(Promiseを使った非同期処理で行われる。)
      }).then(function() {
        console.log('Peer: setLocalDescription() succsess in promise'); 
        // Vanilla ICE の場合には、まだSDPは送らない
        // Tricle ICE の場合は送る
        //sendSdp(peerConnection.localDescription); // ローカルSDPを相手に送る(Trickle ICE の場合)
      }).catch(function(err) {
        console.error(err);
      });
  }

  function setOfferText(remodeSDP) {
    peerConnection = prepareNewConnection();  // offerが送られた相手と新たにpeer接続を作る
    var offer = new RTCSessionDescription({
      type : 'offer',
      sdp : remodeSDP,
    });
    peerConnection.setRemoteDescription(offer); // 相手のSDPをセットする
  }
  
  function setAnswerText(text) {
    if (! peerConnection) {
      console.error('Peer: peerConnection NOT exist!');
      return;
    }
    var answer = new RTCSessionDescription({
      type : 'answer',
      sdp : text,
    });
    peerConnection.setRemoteDescription(answer);  // 相手SDPをセット
  }

  function hangUp() {       // close PeerConnection
    if (peerConnection) {
      console.log('Peer: Hang up.');
      peerConnection.close();
      peerConnection = null;
      pauseVideo(remoteVideo);
    }else{
      console.warn('peer NOT exist.');
    }
  }

// ---------------------- connection handling -----------------------
  function prepareNewConnection() {     // 通信相手ごとに作る
     var peer = new RTCPeerConnection({             // RTCPeerConnectionを作成 
//      offerToReceiveAudio: 0,
//      offerToReceiveVideo: 0,
      iceServers: [
        {"urls": "stun:stun.l.google.com:19302"},   // STUNサーバー。グローバルアドレスを得る
        {"urls": "stun:stun1.l.google.com:19302"},
        {"urls": "stun:stun2.l.google.com:19302"},
      ],
    });

    if (localStream) {                              // P2P用ローカルストリームがあるなら
      peer.addStream(localStream);                  // ローカルの映像/音声ストリームを追加する
      console.log('Peer: ローカル映像を追加しました。');
    }else{
      console.warn('Peer: ローカル映像が無いけど進めます。');
    }

    peer.onnegotiationneeded = function(evt) {      // [1]　SDPの交換が必要です
      console.log('Peer: onnegotiationneeded() SDPの交換が必要です。');
    };
    
    peer.onsignalingstatechange = function() {      // シグナライジング状態変化
      switch(peer.signalingState){
        case 'have-local-offer':
          console.log('Peer: onsignalingstatechange() ローカルSDPを受け取りました。');  // [3]
          break;
        case 'stable':
          console.log('Peer: onsignalingstatechange() リモートSDPを受け取りました。'); // [10]
          break;
      }
    };
    
    peer.onicecandidate = function (evt) { // [4] ICE候補が収集される度に呼び出される。
      if (evt.candidate) {                 // ICE候補が収集された場合
        console.log('Peer: ');
        console.log(evt.candidate);
        // Vanilla ICE の場合には、何もしない
        // Tricle ICE の場合は、ここでICE candidateを相手に送る
        // sendIceCandidate(evt.candidate);  // ICE候補を相手に送る (Trickle ICE の場合)

      } else {                              // ICE候補の収集が完了した時 [6]
        let type = peer.localDescription.type;
        let sdp  = peer.localDescription.sdp;
        console.log('Peer: ICE候補収集完了 & localSDP を相手に送ります. type: ' + type);
        textForSendSdp.value = sdp;              // テキストエリア(送信用)に表示 
        // Trickle ICE の場合は、何もしない
        // Vanilla ICE の場合には、ICE candidateを含んだSDPを相手に送る
//        makeAnswer();               // 自分のSDPをanswerにセットする
        publish(type, sdp);           // シグナリング(MQTT)にSDPを投稿
      }
    };
    
    peer.onicegatheringstatechange = function() {
      switch(peer.iceGatheringState){
        case 'gathering':
          console.log('Peer: onicegatheringstatechange() ICE候補収集中');  // [5]
          break;
        case 'complete':
          console.log('Peer: onicegatheringstatechange() ICE候補収集完了'); // [7]
          break;  
      }
    };

    peer.oniceconnectionstatechange = function() {
      switch(peer.iceConnectionState){
        case 'checking':
          console.log('Peer: oniceconnectionstatechange() ICE接続先調査中');  // [8]
          break;
        case 'connected':
          console.log('Peer: oniceconnectionstatechange() ICE接続中');    // [14]
          break;
        case 'disconnected':
          console.log('Peer: oniceconnectionstatechange() ICE切断');  
          hangUp();
          break;
      }
    };
    
    peer.onconnectionstatechange = function() {
      switch(peer.connectionState) {
        case "connecting":
          console.log('Peer: onconnectionstatechange() 接続中');  // [9]
          break;
        case "connected": 
          console.log('Peer: onconnectionstatechange() 接続完了'); // [15]
          break;
        case "disconnected":
        case "failed":
        case "closed":
          break;
        }
    };
    
    peer.addEventListener("addstream", onRemoteStreamAdded, false); // ストリームがpeerに追加された時
    function onRemoteStreamAdded(event) {  // [12]
      console.log('Peer: onRemoteStreamAdded() リモート映像が追加されました。');
    }

    // SDPの交換が終わると、P2P通信に相手の映像/音声が含まれていればイベントが発生します。
    peer.ontrack = function(event) {      // [13]                           // ontrackイベントが発生した時
      console.log('Peer: peer.ontrack() 映像・音声データが送られて来たので再生します。');
      let stream = event.streams[0];
      playVideo(remoteVideo, stream);                               // 映像を再生する
    };

    peer.addEventListener("removestream", onRemoteStreamRemoved, false);  // ストリームがpeerから離れたとき
    function onRemoteStreamRemoved(event) {
      console.log('Peer: リモート映像が無くなりました。');
      remoteVideo.src = "";                                         // リモートのHTML表示を消す
    }

    // --- other events ----
    peer.onicecandidateerror = function (evt) {   // error
      console.error('Peer: onicecandidateerror() ICE candidate ERROR: ', evt);
    };

    peer.onremovestream = function(event) {
      console.log('Peer: onremovestream()');
      pauseVideo(remoteVideo);
    };

    return peer;
  }
  // --- tricke ICE ---
  function addIceCandidate(candidate) {
    if (peerConnection) {
      console.lpg('Peer: addIceCandidate');
      peerConnection.addIceCandidate(candidate);
    }else{
      console.error('Peer: PeerConnection not exist!');
      return;
    }
  }
