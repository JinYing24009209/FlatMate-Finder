// B.登陆注册后端api | B. Backend login and registration APIs.
const router = require('express').Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const { auth, fail } = require('../middleware/auth');
const { asyncRoute } = require('../middleware/errorHandler');
const v = require('../services/validation');
const { transaction } = require('../services/transaction');

//B01：返回前端的用户账号信息为--用户id，名字，邮箱，角色，学生类型，电话，是否激活 | B01. Return user ID, name, email, role, student type, phone and active status to the frontend.
const publicUser = (u) => ({
  user_id: u.user_id,
  full_name: u.full_name,
  email: u.email,
  role: u.role,
  student_type: u.student_type,
  phone: u.phone,
  is_active: u.is_active,
});

//B02：设置登录 Cookie 的读取限制、跨站发送策略、HTTPS 要求和有效期。 | B02. Configure login cookie access, cross-site policy, HTTPS requirement and lifetime.
const cookieOptions = () => ({
  httpOnly: true,
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 604800000,
});

//B03：生成包含用户 ID 和角色的签名令牌，通过 Cookie 发给浏览器。 | B03. Sign a token containing the user ID and role, and send it to the browser in a cookie.
const issueSession = (res, user) =>
  res.cookie(
    'token',
    jwt.sign({ userId: user.user_id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    }),
    cookieOptions()
  );

//B04：注册功能后端api | B04. Registration API.
router.post(
  '/register',
  asyncRoute(async (req, res) => {
    // 校验输入 | Validate the input.
    const input = v.object(req.body);
    const {
      full_name,
      email,
      password,
      role = 'student',
      phone,
      admin_invite_code,
      student_type,
    } = input;
    const name = v.text(full_name, 'Full name', 120, true);
    const address = v.text(email, 'Email', 254, true).toLowerCase();
    const phoneNumber = v.text(phone, 'Phone', 40);
    const inviteCode = v.text(admin_invite_code, 'Invitation code', 160);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) throw v.invalid('Enter a valid email address.');
    if (typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password) > 72)
      throw v.invalid('Password must contain at least 8 characters and at most 72 UTF-8 bytes.');

    const studentType = role === 'student' ? student_type : null;

    if (role === 'student' && !['housing', 'flatmate'].includes(studentType)) {
      return fail(res, 400, 'Please choose whether you are looking for housing or a flatmate.');
    }
    if (!full_name || !email || !password || !['student', 'advertiser', 'admin'].includes(role))
      return fail(res, 400, 'Name, email, password and a valid role are required.');
    if (password.length < 8) return fail(res, 400, 'Password must be at least 8 characters.');
    // 哈希密码 | Hash the password.
    const password_hash = await bcrypt.hash(password, 12);
    // 同一邮箱串行检查；邀请码扣次和账号写入共同提交。 | Serialize email checks and commit invitation usage with registration.
    const user = await transaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [address]);
      const existing = await client.query('SELECT 1 FROM users WHERE lower(email)=lower($1)', [address]);
      if (existing.rowCount) throw v.invalid('This email is already registered.', 409);
      if (role === 'admin') {
        const invite = await client.query(`UPDATE admin_invite SET used_count=used_count+1
          WHERE code=$1 AND is_active=true AND (expires_at IS NULL OR expires_at>now())
          AND (max_uses IS NULL OR used_count<max_uses) RETURNING invite_id`, [inviteCode]);
        if (!invite.rowCount) throw v.invalid('This admin invitation code is invalid, expired or fully used.', 403);
      }
    // 保存账号 | Save the account.
    const {
      rows: [user],
    } = await client.query(
      `INSERT INTO users
        (full_name, email, password_hash, role, phone, student_type)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [
        name,
        address,
        password_hash,
        role,
        phoneNumber || null,
        studentType,
      ]
    );
      return user;
    });
    issueSession(res, user);
    res.status(201).json({ message: 'Account created.', user: publicUser(user) });
  })
);

//B05：登录功能后端api | B05. Login API.
router.post(
  '/login',
  asyncRoute(async (req, res) => {
    const { email, password } = req.body;
    v.text(email, 'Email', 254, true);
    v.text(password, 'Password', 200, true);
    const {
      rows: [user],
      //查询账户 | Look up the account.
    } = await pool.query('SELECT * FROM users WHERE lower(email)=lower($1)', [email || '']);
    //检查帐号状态和密码 | Check account status and password.
    if (!user || !user.is_active || !(await bcrypt.compare(password || '', user.password_hash)))
      return fail(res, 401, 'Invalid email or password.');
    issueSession(res, user);
    res.json({ message: 'Welcome back.', user: publicUser(user) });
  })
);

//B06：登出功能后端api，通知浏览器清除登录 Cookie | B06. Logout API: ask the browser to clear the session cookie.
router.post('/logout', (_req, res) => {
  res.clearCookie('token', cookieOptions());
  res.json({ message: 'Logged out.' });
});

//B07：查看当前账号信息api，从数据库读取当前用户的账号资料 | B07. Read the current user's account details from the database.
router.get(
  '/me',
  auth,
  asyncRoute(async (req, res) => {
    const {
      rows: [user],
    } = await pool.query('SELECT * FROM users WHERE user_id=$1', [req.user.userId]);
    if (!user) return fail(res, 404, 'User not found.');
    res.json({ user: publicUser(user) });
  })
);

//B08：更新账号信息api，更新当前用户的姓名和电话 | B08. Update the current user's name and phone number.
router.patch(
  '/me',
  auth,
  asyncRoute(async (req, res) => {
    //检查更新的名字合法吗 | Validate the updated name.
    const fullName = v.text(req.body.full_name, 'Full name', 120, true);
    if (!fullName) return fail(res, 400, 'Full name is required.');
    //更新数据库 | Update the database.
    const {
      rows: [user],
    } = await pool.query('UPDATE users SET full_name=$1,phone=$2 WHERE user_id=$3 RETURNING *', [
      fullName,
      v.text(req.body.phone, 'Phone', 40) || null,
      req.user.userId,
    ]);
    res.json({ message: 'Account details updated.', user: publicUser(user) });
  })
);
module.exports = router;
