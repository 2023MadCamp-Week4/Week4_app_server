const express = require("express");
const app = express();
const pool = require("./db").promise();
const cors = require("cors");
const dotenv = require("dotenv");
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
  const { kakao_id, name, user_id, pw, phone_number, location } = req.body;

  try {
    const [result] = await pool.query(
      "INSERT INTO users (kakao_id, name, user_id, pw, phone_number, location) VALUES (?, ?, ?, ?, ?, ?)",
      [kakao_id, name, user_id, pw, phone_number, location]
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

app.post("/api/get-nickname", async (req, res) => {
  const { id } = req.body;
  try {
    const [rows] = await pool.query("SELECT nickname FROM users WHERE id = ?", [
      id,
    ]);
    if (rows.length > 0) {
      // 해당 ID를 가진 사용자가 DB에 존재하면, 닉네임을 반환
      res.json({ nickname: rows[0].nickname });
    } else {
      // 해당 ID를 가진 사용자가 DB에 존재하지 않으면, 적절한 메시지와 함께 응답
      res.json({ message: "No user with this ID found." });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
