'use client';

import { useEffect, useRef, useState } from 'react';

const SIGNALING_URL = 'ws://localhost:8080/ws/voice';
const CHANNEL_ID = '4123312312312662345';

let socket = null;
let peer = null;
let localStream = null;

export default function VoiceCallPage() {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [token, setToken] = useState('');
  const [connected, setConnected] = useState(false);
  const [myUserId, setMyUserId] = useState('');
  
  // 오디오/비디오 상태 관리를 위한 상태 추가
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [channelName, setChannelName] = useState('');

  const sendSignal = (data) => {
    socket?.send(JSON.stringify({
      channelId: CHANNEL_ID,
      type: data.type,
      from: myUserId,
      ...data,
    }));
    console.log('📤 전송:', data.type, data);
  };

  useEffect(() => {
    const t = prompt('🔐 JWT 토큰 입력');
    const channel = prompt('📢 참여할 채널 이름 (선택사항)', '일반');
    if (t) setToken(t);
    if (channel) setChannelName(channel);
  }, []);

  useEffect(() => {
    if (!token) return;

    socket = new WebSocket(`${SIGNALING_URL}?token=${token}`);

    socket.onopen = () => {
      console.log('✅ WebSocket 연결됨');
      const joinMsg = { type: 'join', channelId: CHANNEL_ID };
      console.log('📤 join 메시지 전송', joinMsg);
      socket.send(JSON.stringify(joinMsg));
    };

    socket.onmessage = async (msg) => {
      const data = JSON.parse(msg.data);
      console.log('📩 수신', data);

      // 내 ID 저장 (서버에서 제공하는 경우)
      if (data.userId && !myUserId) {
        setMyUserId(data.userId);
      }

      switch (data.type) {
        case 'offer':
          await createPeer(false);
          await peer.setRemoteDescription(new RTCSessionDescription(data.offer));
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          sendSignal({ type: 'answer', answer });
          break;
        case 'answer':
          await peer.setRemoteDescription(new RTCSessionDescription(data.answer));
          break;
        case 'candidate':
          if (data.candidate) {
            await peer.addIceCandidate(new RTCIceCandidate(data.candidate));
          }
          break;
      }
    };
    
    socket.onerror = (error) => {
      console.error('🚫 WebSocket 오류:', error);
    };
    
    socket.onclose = (event) => {
      console.log('🔌 WebSocket 연결 종료:', event.code, event.reason);
    };
    
    // 컴포넌트 언마운트 시 연결 정리
    return () => {
      socket?.close();
      peer?.close();
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [token]);

  const createPeer = async (isInitiator) => {
    peer = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    peer.onicecandidate = (e) => {
      if (e.candidate) {
        sendSignal({ type: 'candidate', candidate: e.candidate });
      }
    };

    peer.ontrack = (e) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = e.streams[0];
      }
    };

    try {
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      localStream.getTracks().forEach((track) => peer.addTrack(track, localStream));
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStream;
      }
    } catch (err) {
      console.error('미디어 접근 오류:', err);
      alert('카메라 또는 마이크 접근에 실패했습니다: ' + err.message);
    }

    if (isInitiator) {
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      sendSignal({ type: 'offer', offer });
    }
  };

  const startCall = async () => {
    await createPeer(true);
    setConnected(true);
  };

  const leaveCall = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      localStream = null;
    }
    
    peer?.close();
    socket?.close();
    setConnected(false);
    peer = null;
    socket = null;
  };

  // 마이크 켜기/끄기 토글 함수
  const toggleMicrophone = () => {
    if (!localStream) return;
    
    localStream.getAudioTracks().forEach(track => {
      track.enabled = !track.enabled;
    });
    
    setIsMicOn(!isMicOn);
  };

  // 카메라 켜기/끄기 토글 함수
  const toggleCamera = () => {
    if (!localStream) return;
    
    localStream.getVideoTracks().forEach(track => {
      track.enabled = !track.enabled;
    });
    
    setIsCameraOn(!isCameraOn);
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>🎥 디스코드 스타일 음성/화상 채팅</h2>
      {channelName && <h3>📢 채널: {channelName}</h3>}
      
      <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
        <div style={{ position: 'relative' }}>
          <video 
            ref={localVideoRef} 
            autoPlay 
            muted 
            playsInline 
            width="240" 
            height="180"
            style={{ 
              border: '1px solid #ccc', 
              borderRadius: '8px',
              backgroundColor: '#f0f0f0',
              opacity: isCameraOn ? 1 : 0.5
            }}
          />
          <div style={{ 
            position: 'absolute', 
            bottom: '5px', 
            left: '5px', 
            backgroundColor: 'rgba(0,0,0,0.5)', 
            color: 'white', 
            padding: '2px 6px', 
            borderRadius: '4px',
            fontSize: '12px'
          }}>
            나 {!isMicOn && '🔇'}
          </div>
        </div>
        
        <div style={{ position: 'relative' }}>
          <video 
            ref={remoteVideoRef} 
            autoPlay 
            playsInline 
            width="240" 
            height="180"
            style={{ 
              border: '1px solid #ccc', 
              borderRadius: '8px',
              backgroundColor: '#f0f0f0'
            }}
          />
          <div style={{ 
            position: 'absolute', 
            bottom: '5px', 
            left: '5px',
            backgroundColor: 'rgba(0,0,0,0.5)', 
            color: 'white', 
            padding: '2px 6px', 
            borderRadius: '4px',
            fontSize: '12px'
          }}>
            참가자
          </div>
        </div>
      </div>
      
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        {!connected ? (
          <button 
            onClick={startCall}
            style={{
              padding: '8px 16px',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            📞 통화 시작
          </button>
        ) : (
          <button 
            onClick={leaveCall}
            style={{
              padding: '8px 16px',
              backgroundColor: '#f44336',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            ❌ 통화 종료
          </button>
        )}
        
        {connected && (
          <>
            <button 
              onClick={toggleMicrophone}
              style={{
                padding: '8px 16px',
                backgroundColor: isMicOn ? '#2196F3' : '#9E9E9E',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              {isMicOn ? '🎙️ 마이크 끄기' : '🔇 마이크 켜기'}
            </button>
            
            <button 
              onClick={toggleCamera}
              style={{
                padding: '8px 16px',
                backgroundColor: isCameraOn ? '#2196F3' : '#9E9E9E',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              {isCameraOn ? '📹 카메라 끄기' : '🎥 카메라 켜기'}
            </button>
          </>
        )}
      </div>
      
      {connected && (
        <div style={{ fontSize: '14px', color: '#666' }}>
          <div>연결 상태: {connected ? '연결됨' : '연결 안됨'}</div>
          <div>마이크: {isMicOn ? '켜짐' : '꺼짐'}</div>
          <div>카메라: {isCameraOn ? '켜짐' : '꺼짐'}</div>
        </div>
      )}
    </div>
  );
}