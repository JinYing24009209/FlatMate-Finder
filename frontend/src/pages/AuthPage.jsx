// A.登录和注册的前端页面 | A. Frontend login and registration page.
import { useState } from 'react';
import { api } from '../services/api';

//A01:模式（登录或注册），输入信息，错误展示，防止重复提交（重复按按钮） | A01. Store the mode, inputs, errors and busy state to prevent repeated submissions.
export default function AuthPage({ setUser, onBack }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'student',
    student_type: 'housing',
    admin_invite_code: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  //A02：根据发生变化的输入框名称，更新对应字段，同时保留其他字段。 | A02. Update the changed input field by name while preserving other fields.
  const change = (event) => setForm({ ...form, [event.target.name]: event.target.value });

  //A03：最后的提交按钮，处理表单提交：发送请求，成功后更新用户状态，失败时展示错误。 | A03. Handle submission: send the request, update user state on success and show errors on failure.
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = await api(`/auth/${mode}`, { method: 'POST', body: JSON.stringify(form) });
      setUser(data.user);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  //A04：登录注册前端页面 | A04. Render the login and registration page.
  return (
    <main className="auth-page">
      <section className="auth-card">
        <button className="text-button" onClick={onBack}>
          ← Back
        </button>
        <div className="home-brand">
          <b>F</b> FlatMate Finder
        </div>
        <h1>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
        <p>Start with the role that matches how you use the platform.</p>
        <div className="tabs">
          <button className={mode === 'login' ? 'selected' : ''} onClick={() => setMode('login')}>
            Log in
          </button>
          <button
            className={mode === 'register' ? 'selected' : ''}
            onClick={() => setMode('register')}
          >
            Sign up
          </button>
        </div>
        <form onSubmit={submit}>
          {mode === 'register' && (
            <>
              <label>
                Full name
                <input name="full_name" required value={form.full_name} onChange={change} />
              </label>
              <label>
                Account role
                <select name="role" value={form.role} onChange={change}>
                  <option value="student">Student</option>
                  <option value="advertiser">Advertiser / property representative</option>
                  <option value="admin">Administrator (invite only)</option>
                </select>
              </label>

              {form.role === 'student' && (
                <label>
                  What are you looking for?
                  <select name="student_type" value={form.student_type} onChange={change} required>
                    <option value="housing">Find housing</option>
                    <option value="flatmate">Find a flatmate</option>
                  </select>
                </label>
              )}

              {form.role === 'admin' && (
                <label>
                  Internal admin invitation code
                  <input
                    name="admin_invite_code"
                    required
                    value={form.admin_invite_code}
                    onChange={change}
                  />
                </label>
              )}
            </>
          )}
          <label>
            Email
            <input name="email" type="email" required value={form.email} onChange={change} />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              minLength="8"
              required
              value={form.password}
              onChange={change}
            />
          </label>
          {error && <p className="error">{error}</p>}
          <button className="primary wide" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>
        {mode === 'register' && (
          <small>
            Admin registration is restricted to an internal, single-use invitation code.
          </small>
        )}
      </section>
    </main>
  );
}
