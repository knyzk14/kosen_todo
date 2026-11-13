# KosenTodo

## 概要
KosenTodoは、学生のタスク管理とスケジュール共有をシームレスに行うために開発されたカレンダー＆ToDoアプリケーションです。
友人やグループとの予定調整から、学校の課題管理までを一元化し、プライバシーを守りながら効率的にスケジュールを管理できる設計になっています。

## 画像
<div style="display: flex; gap: 10px;">
 <img width="49%" alt="image" src="https://github.com/user-attachments/assets/58bc7d46-f9b0-4a73-9d8d-8125e321c825" />
 <img width="49%" alt="image" src="https://github.com/user-attachments/assets/63591793-9bc9-4838-92d8-a4a4803b7a14" />
</div>
<div style="display: flex; gap: 10px;">
<img width="49%" alt="image" src="https://github.com/user-attachments/assets/0b2fc522-7e01-4e64-be9a-8a50ea5bdc86" />
<img width="49%" alt="image" src="https://github.com/user-attachments/assets/8c18615c-0ffb-4381-aeaa-66c213e6e472" />
</div>


## 主な機能
* **共有カレンダーとプライバシー保護**
  友人やチームでカレンダーを共有できます。個人的な予定やToDoは「予定あり」として時間枠だけが共有（マスキング）され、詳細な内容を他人に知られることはありません。
* **Google Classroom連携**
  Google Classroom上の課題（コースワーク）を自動で取得し、マイカレンダーのToDoリストへ同期します。過去の課題の非表示や、提出状況に応じた自動削除にも対応しています。
* **空き時間検索**
  指定したメンバー間の予定を照らし合わせ、全員の共通の空き時間を瞬時に算出します。
* **リアルタイム同期 (WebSocket)**
  誰かが予定やToDoを追加・更新すると、画面をリロードすることなく、同じカレンダーを見ているメンバーの画面へ即座に変更が反映されます。
* **PC / モバイル自動最適化**
  アクセスした端末を自動で判定し、PCとスマートフォンそれぞれに最適化された専用のユーザーインターフェースを提供します。

## 使用技術
* **Frontend**: HTML / CSS / JavaScript
* **Backend**: Python (FastAPI)
* **Database**: PostgreSQL
* **Authentication**: Firebase Authentication (Google認証)
* **Infrastructure**: Docker, Ubuntu Server, Cloudflare Tunnel
