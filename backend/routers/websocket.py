from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, List
import json

router = APIRouter(prefix="/ws", tags=["websocket"])

# 接続管理クラス
class ConnectionManager:
    def __init__(self):
        # calendar_id をキーに
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, calendar_id: str):
        # 接続許可
        await websocket.accept()
        # 無ければ作成
        if calendar_id not in self.active_connections:
            self.active_connections[calendar_id] = []

        self.active_connections[calendar_id].append(websocket)

    def disconnect(self, websocket: WebSocket, calendar_id: str):
        if calendar_id in self.active_connections:
            if websocket in self.active_connections[calendar_id]:
                self.active_connections[calendar_id].remove(websocket)
            # 接続が無ければ削除
            if not self.active_connections[calendar_id]:
                del self.active_connections[calendar_id]

    async def broadcast(self, message: dict, calendar_id: str):
        # 部屋にいる全員にメッセージを一斉送信する
        if calendar_id in self.active_connections:
            for connection in self.active_connections[calendar_id]:
                await connection.send_text(json.dumps(message))

# 管理人インスタンス
manager = ConnectionManager()


# エンドポイント
@router.websocket("/{calendar_id}")
async def websocket_endpoint(websocket: WebSocket, calendar_id: str):

    await manager.connect(websocket, calendar_id)
    try:
        while True:
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, calendar_id)