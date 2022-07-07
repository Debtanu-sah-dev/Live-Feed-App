// Stream server For Peer To Peer Connection

const servers = {
    iceServers: [{
        urls: [
            "stun:stun.l.google.com:19302",
            "stun:stun1.l.google.com:19302",
            "stun:stun2.l.google.com:19302",
            "stun:stun3.l.google.com:19302",
            "stun:stun4.l.google.com:19302"
        ]
    }],
    iceCandidatePoolSize: 10
}

//Global Stream

let peerconnections = [];
let localStream = null;

// DOM Elements

const video = document.querySelector('#video');
const link = document.querySelector('[data-link]');
const list = document.querySelector('[data-list]');
const copy = document.querySelector('[data-copy]');
const camera = document.querySelector('[data-camera]');
const connectlink = document.querySelector('[data-connectlink]');
let isCamerOn = false;

async function updateList(cameras){
    list.innerHTML = "";
    let arr = await cameras;
    arr.map((e) => {
        const option = document.createElement('option');
        option.label = e.label;
        option.value = e.deviceId;

        return option;
    }).forEach((cameraOption) => {
        list.appendChild(cameraOption)
    })
}

async function getCameras() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(device => device.kind === "videoinput")
}

camera.addEventListener("click", async function () {
    localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: {
            deviceId: list.value
        }
    });
    
    video.srcObject = localStream;
    video.play();

    isCamerOn = true;
})

list.addEventListener("change", async function () {
    camera.click();
});

async function connect(update,PeerConnection) {
    if(isCamerOn){
        update ? (connectlink.style.display = "none"):null;
        const feedDoc = db.collection("feeds").doc();
        const offer = feedDoc.collection("offer");
        const candidate = feedDoc.collection("candidate");
        update ? (link.innerText = feedDoc.id):null;
        localStream.getTracks().forEach(track => {
            PeerConnection.addTrack(track, localStream);
        });

        PeerConnection.onicecandidate = event => {
            event.candidate && offer.add(event.candidate.toJSON())
        }
        const offerDescriptor = await PeerConnection.createOffer();
        await PeerConnection.setLocalDescription(offerDescriptor);
    
        await feedDoc.set({
            offer:{
                sdp: PeerConnection.localDescription.sdp,
                type: PeerConnection.localDescription.type
            }
        });

        feedDoc.onSnapshot(async (snapshot) => {
            const data = snapshot.data();
            if(!PeerConnection.currentRemoteDescription && data?.answer){
                let remDesc = new RTCSessionDescription(data.answer);
                await PeerConnection.setRemoteDescription(remDesc);
            }
        })

        candidate.onSnapshot(async (snapshot) => {
            snapshot.docChanges().forEach(async (change) => {
                if(change.type === "added"){
                    let ICE = new RTCIceCandidate(change.doc.data());
                    await PeerConnection.addIceCandidate(ICE)
                }
            })
        })
    }
    else{
        alert("Please open your camera first");
        camera.click()
    }
}

connectlink.addEventListener("click",async function () {
    let pc = new RTCPeerConnection(servers);
    peerconnections.push(pc)
    connect(true,pc);
})

const newList = getCameras();
updateList(newList);