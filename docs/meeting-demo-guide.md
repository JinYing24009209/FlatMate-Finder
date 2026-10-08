# Pengrui Su：明天组会演示流程

完整展示约15分钟，问答5分钟。按“操作—功能—代码—解释”讲，不要逐行朗读代码。按实际贡献说明自己负责、维护或协作的部分。

## 0. 先使用本次完整交付

本目录 FlatMate-Finder 是完整修改副本，已做 Gemini 接入、双语注释和格式整理。旧项目部分文件权限异常，不能把旧目录中的局部修改当成完整交付。

建议把完整副本放到 E:\project\FlatMate-Finder-meeting。把原 backend/.env 复制到新 backend/.env；如原 frontend/.env 有配置，也在自己电脑复制。不要投屏或上传 .env。本次共用现有 AI_MODE、GEMINI_API_KEY 和 GEMINI_TEXT_MODEL，不需要新 key。数据库沿用原连接，不需要重新建库，不要运行 seed:demo。

## 1. 启动（今晚完成一次，明天只启动服务）

在 VS Code 打开新项目。第一个终端执行：

    cd E:\project\FlatMate-Finder-meeting\backend
    npm.cmd ci
    npm.cmd run dev

首次安装才需要 npm.cmd ci。看到 FlatMate Finder API listening on 5000 后保留终端。

浏览器打开 http://localhost:5000/api/health，应返回 {"status":"ok"}。

第二个终端执行：

    cd E:\project\FlatMate-Finder-meeting\frontend
    npm.cmd ci
    npm.cmd run dev

打开终端的 Local 地址，通常是 http://localhost:5173。不要双击 index.html。若端口被占用，停止旧项目进程再启动，避免多个项目或 CORS 端口不一致。

## 2. 提前准备账号和窗口

H：找房子的学生；F1：找室友的学生；F2：第二位找室友的演示学生。若要演示房东回复，再准备由你们控制的 Advertiser 账号。

今晚确认密码。不要向陌生真实用户发送演示消息。F1 用普通浏览器窗口，F2 用隐私窗口或另一个浏览器。同一浏览器普通标签页共享 Cookie，不能代表两个独立登录用户。

F1、F2 都进入 My profile：填写 Auckland、预算180–300、Morning、quiet, tidy；另一人预算可为200–280。保存资料，打开参与匹配的开关。只有有个人资料且允许匹配的 flatmate 学生才会成为候选人。使用获授权的头像，不把陌生人的照片冒充本人。

## 3. 正式演示：逐步照着操作

### 0:00–0:40 首页开场

操作：打开首页，指出 Join free、Explore rooms 和下方房源卡片。

功能：介绍平台，并引导注册或浏览房源。

代码：frontend/src/pages/HomePage.jsx；搜索 api('/listings') 和 listings.map。

中文：这是团队的学生租房与室友平台，我今天展示账号、个人资料、收藏、咨询和室友匹配。首页宣传区92%是静态示意，实际评分在匹配页，不要混淆。

英文：This is our student housing and flatmate platform. I will demonstrate accounts, profiles, saved items, conversations and flatmate matching.

### 0:40–2:20 注册、登录和学生类型

操作：Join free → Sign up → Account role 选 Student。展示 Find housing、Find a flatmate。说明管理员需要邀请码，不现场注册管理员。切到 Log in，登录 H。

结果：Dashboard；侧栏 Browse listings、Saved listings、Enquiries、My profile。

代码：AuthPage.jsx 的 A01 状态、A02 change、A03 submit、A04 表单；authRoutes.js 的 B04注册、B05登录、publicUser；accountNavigation.js 的 getAccountPages；App.jsx 管理当前用户与页面。

中文：前端提交表单，后端检查输入。注册时 bcrypt 保存密码哈希；登录成功后签发 JWT，通过 HttpOnly Cookie 维持会话。学生类型返回前端，控制导航。

英文：The frontend sends the form to the backend. The backend validates the account and issues a signed session token. The student type determines the navigation.

可能提问：A02 中 event.target.name 找到变化字段，展开旧 form 保留其他输入。JWT 是签名令牌，不是加密密码。隐藏菜单不是安全边界，后端仍需权限检查。

### 2:20–4:00 个人资料和保存

操作：H → My profile。填写预算180–300、Preferred location Auckland、Study routine Morning、Lifestyle preferences quiet, tidy、未来入住日期。点保存，切到 Dashboard 再返回 My profile。

结果：数据仍在，说明写入数据库而不是只留在页面状态中。

代码：frontend/src/pages/ProfilePage.jsx 搜索 const save；backend/src/routes/authRoutes.js B08；backend/src/routes/profileRoutes.js D01、D02。

中文：PATCH /auth/me 更新名字和电话，PUT /profile/me 保存偏好。ON CONFLICT(user_id) DO UPDATE 实现首次插入、已有则更新。读取日期时转为 YYYY-MM-DD。

英文：Account details and matching preferences are stored separately. The profile endpoint inserts or updates the profile, and reopening the page loads it from the database.

### 4:00–5:40 房源浏览、详情和收藏

操作：Browse listings，不输入搜索词，展示 All listings。点击一张 available 房源卡片 → Save listing → Saved listings → 再打开这张房源。

结果：未搜索前展示可租房源；收藏页和详情页的收藏状态一致。

代码：BrowsePage.jsx、ListingCard.jsx、ListingDetailPage.jsx 的 toggleSave；backend/src/routes/listingRoutes.js 搜索 /save；communityRoutes.js E02查询收藏。

中文：收藏表只保存用户和房源的关系，不复制房源内容。

英文：Saving stores a relationship between the user and the listing. The saved page reads that relationship from the database.

可问老师：Would a comparison view be useful for choosing between saved listings?

### 5:40–7:10 房源咨询、消息和通知

操作：在你们控制的房源详情中输入 Hi, is this room available for a viewing this weekend? 点 Start conversation，打开 Enquiries。如果准备了发布者账号，用另一个浏览器回复。

代码：listingRoutes.js 创建咨询；communityRoutes.js E03列表、E04权限、E05读取、E06发送、E07状态、E08–E10通知未读；notificationService.js 的 notify；ChatPanel.jsx 显示聊天。

中文：消息正文写入 enquiry_message，站内提醒写入 notification。后端检查是否为会话参与者，读会话时更新已读状态。不是短信或邮件，也不宣称是 WebSocket 实时通信。

英文：Messages and notifications are stored separately. The backend checks access, saves the message and notifies the other participant.

### 7:10–8:00 切换找室友学生

操作：Log out，登录 F1。展示 Dashboard、Flatmate matches、Saved flatmates、Enquiries、My profile。如果侧栏折叠，先点展开。

代码：authRoutes.js 的 student_type 和 publicUser；accountNavigation.js。

英文：Both account types are students. The student_type field separates the housing journey from the flatmate journey.

### 8:00–10:30 Gemini 室友匹配（重点）

操作：Flatmate matches → 清空搜索条件 → 等待加载。观察卡片上的 Gemini AI matching 或 Local fallback matching，点击卡片查看分数与理由。

代码：communityRoutes.js E11 loadMatches、E12；aiService.js F09 enhancedFlatmateScores、matchingPreferences、generateGeminiJson；F01–F08 flatmateMatchScore 是保留的本地兜底；flatmateRoutes.js 的 enhancedFlatmateMatchScore 用于详情；FlatmateCard.jsx 和 FlatmateDetailPage.jsx 展示来源。

按此顺序讲：
1. 数据库筛选有效、允许匹配的 flatmate 学生，排除自己。
2. 只提取地点、预算、学习习惯、生活标签；不传姓名、邮箱、电话、照片、聊天记录或用户ID。
3. 使用与房源总结相同配置的 Gemini 模型，让它返回 JSON 分数和理由。
4. 后端检查候选索引、整数分数范围、理由格式。重复或无效结果不使用。
5. 请求超时、服务故障、无效返回或没配置时，使用原 F01–F08 本地算法。
6. 5分钟缓存让相同偏好的列表、收藏、详情复用结果；偏好变化后重新计算。

英文：We first filter eligible profiles. Gemini compares their accommodation preferences and returns scores with explanations. We validate the response. If the API fails, local scoring keeps the feature available.

说明：分数是建议，不是共同居住成功概率。没有共同可比较资料时不生成分数。部分匹配偏好会发送给 Gemini，不能说所有资料永不离开服务器。

若显示 Local fallback：如实说明外部服务不可用，本地算法接管。这不是功能完全失效，也不能说它是 Gemini 评分。

可问老师：What evidence would you expect to see to evaluate the quality of our recommendations?

### 10:30–11:40 室友收藏

操作：详情 → Save flatmate → Saved flatmates → 打开同一人。可再取消收藏，观察收藏页移除卡片。

代码：communityRoutes.js E13、E14、E15、E11 savedOnly。

中文：收藏页是候选集合的子集。LEFT JOIN 让未收藏的人仍出现在匹配页。savedOnly 为 true 时才筛选已收藏的人。收藏不加分；两个页面使用同一评分方法。

英文：The saved page is a shortlist. Saving a person does not increase the score. Both pages share the same matching logic.

### 11:40–13:00 室友私聊

操作：F1 打开 F2，输入 Hi, we have similar preferences. Would you like to discuss sharing a flat? 点 Send enquiry。F2 在独立窗口进入 Enquiries 回复；F1 展示回复。

代码：backend/src/routes/flatmateRoutes.js 的 /:id/enquiries、/:id/messages；frontend/src/pages/FlatmateEnquiriesPage.jsx。

中文：室友使用 flatmate_conversation、flatmate_message，与房源咨询不同。两个用户ID排序形成唯一的一对，避免双方各建一条重复会话。消息和通知通过事务一起保存。

英文：Flatmate chats use separate tables from housing enquiries. Each pair of students shares one conversation, and only its participants can access it.

按实际分工说明这一扩展功能由谁实现、自己负责什么整合，不把整个模块都归为个人原创。

### 13:00–14:00 后端结构

操作：切到 VS Code 打开 backend/server.js，不打开 .env。

代码：express.json 解析 JSON；cookieParser 读取 Cookie；app.use 挂载路由；最后 app.use(errorHandler)。auth.js 验证 JWT，allow 检查角色；errorHandler.js 包装异步错误并统一返回500。

英文：The server connects middleware and routes. Authentication protects requests, and a shared error handler returns a consistent response when an unexpected error occurs.

### 14:00–15:00 总结并提问

英文：My demonstration covered accounts, profiles, saved items, conversations and flatmate matching. Gemini enhances recommendations, while local scoring provides a fallback. Our next step is to evaluate the results with user feedback.

选一个问题：Would you prefer us to prioritise usability testing or matching evaluation in the next iteration?

## 4. 老师让你打开代码：速查表

用 Ctrl+P 打开文件，Ctrl+F 搜索注释编号或函数名。不要背会因格式化改变的行号。

|提问|文件及定位|一句话|
|---|---|---|
|登录按钮|AuthPage.jsx A03|发送表单，更新状态或展示错误|
|密码存储|authRoutes.js bcrypt.hash|保存哈希，登录比较|
|登录会话|authRoutes.js issueSession；auth.js jwt.verify|Cookie带签名令牌，后端验证|
|两类学生|accountNavigation.js；authRoutes.js|同一角色，不同student_type|
|资料保存|profileRoutes.js ON CONFLICT|首次新增，已有更新|
|收藏关系|communityRoutes.js E14|记录谁收藏谁|
|候选列表|communityRoutes.js E11|先过滤，再评分排序|
|外部AI|aiService.js enhancedFlatmateScores|Gemini优先，验证结果，失败兜底|
|本地评分|aiService.js F01–F08|地点30、预算25、习惯20、标签25|
|聊天权限|accessibleEnquiry；flatmateRoutes.js conversation|检查是否为允许的参与者|
|站内通知|notificationService.js notify|向通知表插入记录|
|错误|errorHandler.js|记录详情，前端返回通用500|

## 5. 演示前检查与故障应对

- 明天先查 /api/health，再登录；把三个账号和浏览器窗口准备好。
- 完整排练一遍，记录要展示的房源和室友，不现场临时挑陌生账号。
- 预先打开 A–H 对应代码标签页，折叠不相关函数。
- 匹配没分数：先确认双方有可比较资料。匹配列表为空：清空筛选、检查账号类型和可见性。
- 房源列表只显示 available；不要修改业务状态来凑数量。
- 保存后切出再进入，确认数据持久化。
- Gemini 初次请求可能慢，不连续点击。可在演示前加载一次。
- 不要现场断网演示兜底，远程数据库也会断开。可使用提供的测试记录，或单独环境使用 AI_MODE=local。
- 保存成功截图作为网络故障备选；使用截图时说明是预先记录。
- 首页静态92%、本地房源评分、自然语言规则解析、Gemini embedding语义排序、Gemini总结、Gemini室友评分是不同实现，不要全部说成大模型评分。

Gemini 官方结构化输出文档：https://ai.google.dev/gemini-api/docs/generate-content/structured-output
