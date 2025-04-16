'use client';

import { useEffect, useState } from 'react';
import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';
import axios from 'axios';

const DM_ID = '567329414493245440';

export default function StompChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [client, setClient] = useState(null);
  const [token, setToken] = useState(null);

  const [editId, setEditId] = useState(null);
  const [editContent, setEditContent] = useState('');

  // 1. 토큰 입력 받고 세션 유지 X
  useEffect(() => {
    const inputToken = prompt('🪪 JWT 토큰 입력');
    if (inputToken) {
      setToken(inputToken);
    }
  }, []);

  // 2. 메시지 로드
  useEffect(() => {
    if (!token) return;
    axios
      .get(`http://localhost:8080/dm/${DM_ID}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        setMessages(res.data.response || []);
      })
      .catch((err) => {
        console.error('❌ 메시지 불러오기 실패:', err);
      });
  }, [token]);

  // 3. WebSocket 연결
  useEffect(() => {
    if (!token) return;
    const socket = new SockJS(`http://localhost:8080/ws-chat?token=${token}`);
    const stomp = new Client({
      webSocketFactory: () => socket,
      reconnectDelay: 5000,
      onConnect: () => {
        stomp.subscribe(`/topic/dm/${DM_ID}`, (msg) => {
          const data = JSON.parse(msg.body);
          if (data?.type === 'SEND') {
            setMessages((prev) => [...prev, data.message]);
          } else if (data?.type === 'UPDATE') {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.messageId === data.message.messageId
                  ? { ...msg, content: data.message.content }
                  : msg
              )
            );
          } else if (data?.type === 'DELETE') {
            setMessages((prev) =>
              prev.filter((msg) => msg.messageId !== data.message.messageId)
            );
          }
        });
        setClient(stomp);
      },
    });
    stomp.activate();
    return () => stomp.deactivate();
  }, [token]);

  const sendMessage = () => {
    if (!client || !input.trim()) return;
    client.publish({
      destination: `/app/dm/${DM_ID}`,
      body: JSON.stringify({ content: input.trim() }),
    });
    setInput('');
  };

  const startEdit = (id, content) => {
    setEditId(id);
    setEditContent(content);
  };

  const submitEdit = async () => {
    if (!editContent.trim()) return;
    try {
      await axios.patch(
        `http://localhost:8080/dm/${DM_ID}/message/${editId}`,
        { content: editContent },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      alert('✅ 메시지 수정 완료');
      setMessages((prev) =>
        prev.map((msg) =>
          msg.messageId === editId ? { ...msg, content: editContent } : msg
        )
      );
      setEditId(null);
      setEditContent('');
    } catch (err) {
      console.error('❌ 메시지 수정 실패:', err);
      alert('❌ 수정 실패');
    }
  };

  const deleteMessage = async (messageId) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    try {
      await axios.delete(
        `http://localhost:8080/dm/${DM_ID}/message/${messageId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      alert('🗑️ 메시지 삭제 완료');
    } catch (err) {
      console.error('❌ 메시지 삭제 실패:', err);
      alert('❌ 삭제 실패');
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>💬 DM 채팅</h2>

      <div style={{ marginBottom: '10px' }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="메시지를 입력하세요"
        />
        <button onClick={sendMessage} style={{ marginLeft: '10px' }}>
          보내기
        </button>
      </div>

      <ul>
        {messages.map((msg, i) => (
          <li key={i}>
            <b>{msg.nickName}</b>: {msg.content}
            <button
              style={{ marginLeft: '10px' }}
              onClick={() => startEdit(msg.messageId, msg.content)}
            >
              ✏️ 수정
            </button>
            <button
              style={{ marginLeft: '5px', color: 'red' }}
              onClick={() => deleteMessage(msg.messageId)}
            >
              🗑️ 삭제
            </button>
          </li>
        ))}
      </ul>

      {editId && (
        <div style={{ marginTop: '20px' }}>
          <h4>✏️ 메시지 수정</h4>
          <input
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
          />
          <button onClick={submitEdit} style={{ marginLeft: '10px' }}>
            수정 완료
          </button>
          <button onClick={() => setEditId(null)} style={{ marginLeft: '5px' }}>
            취소
          </button>
        </div>
      )}
    </div>
  );
}
