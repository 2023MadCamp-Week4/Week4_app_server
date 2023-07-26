const express = require("express");
const app = express();
const pool = require("./db").promise();
const cors = require("cors");
const dotenv = require("dotenv");
const WebSocket = require("ws");
dotenv.config();

app.use(cors());
app.use(express.json());

app.listen(process.env.PORT || 4000, () => {
  console.log("Server has started on port 4000");
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");
});

// 회원가입
app.post("/api/user", async (req, res) => {
  const { kakao_id, name, user_id, pw, phone_number, location, profileURL } =
    req.body;

  try {
    const [result] = await pool.query(
      "INSERT INTO users (kakao_id, name, user_id, pw, phone_number, location, profileURL) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [kakao_id, name, user_id, pw, phone_number, location, profileURL]
    );
    res.status(201).json({ message: "New user added!" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DB에 있는 유저인지 확인 (카카오 로그인 시)
app.post("/api/check-user", async (req, res) => {
  const { id } = req.body;
  try {
    const [rows] = await pool.query("SELECT * FROM users WHERE kakao_id = ?", [
      id,
    ]);
    if (rows.length > 0) {
      res.json({ exists: true });
    } else {
      res.json({ exists: false });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/user", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM users");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 로그인
app.post("/api/login", async (req, res) => {
  const { userid, pw } = req.body;
  try {
    const [rows] = await pool.query(
      "SELECT * FROM users WHERE user_id = ? AND pw = ?",
      [userid, pw]
    );

    if (rows.length > 0) {
      res.json(rows[0]);
    } else {
      res.status(404).json({ message: "User not found." });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 이름 가져오기
app.post("/api/get-name", async (req, res) => {
  const { id } = req.body;
  try {
    const [rows] = await pool.query(
      "SELECT name FROM users WHERE kakao_id = ?",
      [id]
    );
    if (rows.length > 0) {
      res.json({ name: rows[0].name });
    } else {
      res.json({ message: "No user with this ID found." });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 내 정보에서 이름 가져오기
app.get("/api/get_user", async (req, res) => {
  const userId = req.query.id;

  try {
    const [rows] = await pool.query(
      "SELECT name FROM users WHERE kakao_id = ?",
      [userId]
    );

    if (rows.length > 0) {
      res.json(rows[0]);
    } else {
      res.status(404).json({ message: "User not found" });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 모든 유저 정보 가져오기
app.get("/api/get_all_users", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM users");
    res.status(200).json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 상태 메시지 변경
app.post("/api/update_state_message", async (req, res) => {
  const { id, stateMessage } = req.body;

  try {
    const [result] = await pool.query(
      "UPDATE users SET stateMessage = ? WHERE kakao_id = ?",
      [stateMessage, id]
    );
    if (result.affectedRows > 0) {
      res.status(200).json({ message: "State message updated successfully!" });
    } else {
      res.status(404).json({ message: "User not found" });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 유저의 상태 메시지 가져오기
app.get("/api/get_user_state_message", async (req, res) => {
  const { id } = req.query;

  try {
    const [rows] = await pool.query(
      "SELECT stateMessage FROM users WHERE kakao_id = ?",
      [id]
    );
    if (rows.length > 0) {
      res.status(200).json({ stateMessage: rows[0].stateMessage });
    } else {
      res.status(404).json({ message: "User not found" });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

//웹 소켓
const wss = new WebSocket.Server({ port: 4001 });

wss.on("connection", (ws) => {
  console.log("server on ");
  ws.on("message", (data) => {
    console.log(`Received from user: ${data}`);
  });
});

// post 눌렀을 때 약속DB에 추가
app.post("/api/appointment_add", async (req, res) => {
  const { members, times, place, content, location } = req.body;
  try {
    const membersString = members.join(",");
    const [result] = await pool.query(
      `INSERT INTO appointment (members, times, place, content, location) 
       VALUES (JSON_ARRAY(${membersString}), ?, ?, ?, JSON_OBJECT('latitude', ?, 'longitude', ?))`,
      [times, place, content, location.latitude, location.longitude]
    );
    res.status(201).json({ message: "New appointment added!" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 이전 약속 불러오기 (내가 포함된 약속만)
app.get("/api/past_appointments", async (req, res) => {
  const currentDate = new Date();
  const userId = req.query.id;

  try {
    const [results] = await pool.query(
      "SELECT * FROM appointment WHERE times < ? AND members LIKE ?",
      [currentDate, `%${userId}%`]
    );

    res
      .status(200)
      .json({ message: "Fetched past appointments!", data: results });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 미래 약속 불러오기 (내가 포함된 약속만)
app.get("/api/future_appointments", async (req, res) => {
  const currentDate = new Date();
  const userId = req.query.id;

  try {
    const [results] = await pool.query(
      "SELECT * FROM appointment WHERE times > ? AND members LIKE ?",
      [currentDate, `%${userId}%`]
    );

    res
      .status(200)
      .json({ message: "Fetched past appointments!", data: results });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 오늘의 약속 불러오기 (내가 포함된 약속만)
app.get("/api/today_appointments", async (req, res) => {
  const currentDate = new Date();
  const startOfDay = new Date(currentDate.setHours(0, 0, 0, 0));
  const endOfDay = new Date(currentDate.setHours(23, 59, 59, 999));
  const userId = req.query.id;

  try {
    const [results] = await pool.query(
      "SELECT * FROM appointment WHERE times BETWEEN ? AND ? AND members LIKE ?",
      [startOfDay, endOfDay, `%${userId}%`]
    );

    res
      .status(200)
      .json({ message: "Fetched today's appointments!", data: results });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// kakao_id로 user의 이름 찾기
app.get("/api/get_username_byid", async (req, res) => {
  const userId = req.query.id;
  console.log(userId);
  console.log("7777777");
  try {
    const [rows] = await pool.query(
      "SELECT name FROM users WHERE kakao_id = ?",
      [userId]
    );

    if (rows.length > 0) {
      res.json({ name: rows[0].name });
    } else {
      res.status(404).json({ error: "User not found" });
    }
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error: " + err });
  }
});

// 위치 요청
app.post("/api/send_request", async (req, res) => {
  const { send_userid, receive_userid, appointment_id } = req.body;

  try {
    const [result] = await pool.query(
      "INSERT INTO request1 (send_userid, receive_userid, appointment_id) VALUES (?, ?, ?)",
      [send_userid, receive_userid, appointment_id]
    );
    res.status(201).json({ message: "Request sent successfully!" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 이름으로 사용자의 kakao_id 조회
app.get("/api/get_userid_byname", async (req, res) => {
  const { name } = req.query;
  try {
    const [rows] = await pool.query(
      "SELECT kakao_id FROM users WHERE name = ?",
      [name]
    );
    if (rows.length > 0) {
      res.json(rows[0].kakao_id);
    } else {
      res.status(404).json({ message: "User not found" });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 나에게 온 request가 있는지 탐지
app.get("/api/check_requests", async (req, res) => {
  const { id } = req.query;

  try {
    const [rows] = await pool.query(
      "SELECT * FROM request1 WHERE receive_userid = ? AND flag = 0",
      [id]
    );
    res.status(200).json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 수락 버튼을 눌러서 request1 Table의 Flag를 1로 바꾸기
app.post("/api/update_request1", async (req, res) => {
  const { id, flag } = req.body;

  try {
    const [result] = await pool.execute(
      "UPDATE request1 SET flag = ? WHERE id = ?",
      [flag, id]
    );

    res.status(200).json({ message: "request1 table updated!" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 수락 버튼을 눌러서 request2 Table에 정보 삽입
app.post("/api/insert_request2", async (req, res) => {
  const {
    send_userid,
    receive_userid,
    appointment_id,
    latitude,
    longitude,
    flag,
  } = req.body;

  try {
    const [result] = await pool.execute(
      "INSERT INTO request2 (send_userid, receive_userid, appointment_id, latitude, longitude, flag) VALUES (?, ?, ?, ?, ?, ?)",
      [send_userid, receive_userid, appointment_id, latitude, longitude, flag]
    );

    res.status(201).json({ message: "New row added to request2 table!" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 나에게 온 request2가 있는지 탐지
app.get("/api/check_request2", async (req, res) => {
  const { id } = req.query;

  try {
    const [rows] = await pool.execute(
      "SELECT * FROM request2 WHERE receive_userid = ? AND flag = 0",
      [id]
    );
    res.status(200).json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 닫기 버튼을 눌러서 request1 Table의 Flag를 1로 바꾸기
app.post("/api/update_request2", async (req, res) => {
  const { id, flag } = req.body;

  try {
    const [result] = await pool.execute(
      "UPDATE request2 SET flag = ? WHERE id = ?",
      [flag, id]
    );

    res.status(200).json({ message: "request2 table updated!" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
