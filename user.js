function formatDateTime(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${year}년 ${month}월 ${day}일 ${hour}시 ${min}분`;
}

// 회원가입
router.post('/register', async (req, res) => {
    const { uid, name, age, gender } = req.body;

    if (!uid || !name) return res.status(400).json({ error: "잘못된 요청입니다." });
    
    try {
        await db.collection('user').doc(uid).set({
            name,
            age,
            gender,
            signUpDate: formatDateTime(),
            lastLoginDate: formatDateTime()
        });

        res.json({ message: "회원가입 완료" });
    } catch(error) {
        console.error(error);
        res.status(500).json({ error: "회원가입 실패" });
    }
});

// 로그인
router.post('/login', async (req, res) => {
    const { uid } = req.body;

    if (!uid) return res. status(400).json({ error: "잘못된 요청입니다." });

    try {
        await db.collection('user').doc(uid).update({
            lastLoginDate: formatDateTime()
        });

        res.json({ message: "로그인 날짜 업데이트 완료" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "업데이트 실패" });
    }
});

module.exports = router;