const express = require('express');
const router = express.Router();
const { db } = require('../firebase');
const { FieldValue, Transaction } = require('firebase-admin/firestore');

function formatDateTime(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${year}년 ${month}월 ${day}일 ${hour}시 ${min}분`;
}


// 계좌 생성 API
router.post('/create', async (req, res) => {
    const { uid, password } = req.body;

    if (!uid || !password) {
        return res.status(400), json({ error: "잘못된 요청입니다." });
    }

    if (password.length !== 6) {
        return res.status(400).json
    }

    try {
        const userSnap = await db.collection('user').doc(uid).get();
        const nickName = userSnap.exists ? userSnap().name || "이름 없음" : "이름 없음";

        const randomNumber = Math.floor(Math.random() * 10000000000000).toString().padStart(13, '0');

        await db.collection('Account').add({
            uid,
            회원계좌명: nickName,
            계좌번호: randomNumber,
            Password: password,
            잔액: 0,
            생성일 : formatDateTime()
        });

        res.json({ message: "계좌 생성 완료", accountNumber: randomNumber });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "계좌 생성 실패" });
    }
});


// 입금 API
router.post('/deposit', async (req, res) => {
    const { uid, accountNumber, amount } = req.body;

    if (!uid || !accountNumber || !amount || amount <= 0) {
        return res.status(400).json({ error: "잘못된 요청입니다."});
    }

    try {
        const q = await db.collection('Account')
            .where('계좌번호', '==', accountNumber)
            .get();

        if (q.empty) return res.status(404).json({ error: "계좌를 찾을 수 없습니다."});

        const accountDoc = q.docs[0];
        const accountData = accountDoc.data();

        if (accountData.잔액 < amount) {
            return res.status(400).json({ error: `잔액 부족 | 현재잔액: ${accountData.잔액.toLocaleString()}원` });
        }

        const newBalance = accountData.잔액 - amount;

        await accountDoc.ref.update({ 잔액: FieldValue.increment(-amount) });

        await db.collection('TransactionHistory').add({
            uid,
            회원계좌명: accountData.회원계좌명,
            계좌번호: accountNumber,
            거래금액: amount,
            잔액: newBalance,
            거래일시: formatDateTime(),
            거래유형: "입금"
        });

        res.json({ message: "입금 완료", 잔액: newBalance });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "입금 실패" });
    }
})

// 출금 API
router.post('withdraw', async (req, res) => {
    const { uid, accountNumber, amount } = req.body;

    if (!uid || !accountNumber || !amount || amount <= 0) {
        return res.status(400).json({ error: "잘못된 요청입니다." });
    }

    try {
        const q = await db.collection('Account')
            .where('계좌번호', '==', accountNumber)
            .get();
            
        if (q.empty) return res.status(404).json({ error: "계좌를 찾을 수 없습니다."});
        
        const accountDoc = q.docs[0];
        const accountData = accountDoc.data();

        if (accountData.잔액 < amount) {
            return res.status(400).json({ error: `잔액 부족 | 현재잔액: ${accountData.잔액.toLocaleString()}원` });
        }

        const newBalance = accountData.잔액 - amount;

        await accountDoc.ref.update({ 잔액: FieldValue.increment(-amount) });

        await db.collection('TransactionHistory').add({
            uid: user.uid,
            회원계좌명: accountData.회원계좌명,
            계좌번호: accountNumber,
            거래금액: -amount,
            잔액: newBalance,
            거래일시: formatDateTime(),
            거래유형: "출금"
        });

        res.json({ message: "출금 완료", 잔액: newBalance });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "출금 실패" });
    }
});


// 송금 API
router.post('/transfer', async (req, res) => {
    const { uid, myAccountNumber, targetAccountNumber, amount, password } = req.body;

    if (!uid || !myAccountNumber || !targetAccountNumber || !amount || amount <= 0) {
        return res.status(400).json({ error: "잘못된 요청입니다." });
    }

    if (myAccountNumber === targetAccountNumber) {
        return res.status(400).json({ error: "본인 계좌로는 송금할 수 없습니다." });
    }

    try {
        await db.runTransaction(async (transaction) => {
            const myQ = await db.collection('Account').where('계좌번호', '==', myAccountNumber).get();
            if (myQ.empty) throw "내 계좌를 찾을 수 없습니다.";

            const myDoc = myQ.docs[0];
            const myData = myDoc.data();

            if (myData.Password !== password) throw "비밀번호가 일치하지 않습니다.";
            if (myData.잔액 < amount) throw "잔액이 부족합니다.";

            const sendQ = await db.collection('Account').where('계좌번호', '==', targetAccountNumber).get();
            if (sendQ.empty) throw "상대 계좌를 찾을 수 없습니다.";

            const sendDoc = sendQ.docs[0];
            const sendData = sendDoc.data();

            const myNewBalance = myData.잔액 - amount;
            const sendNewBalance = sendData.잔액 + amount;

            transaction.update(myDoc.ref, { 잔액: FieldValue.increment(-amount) });
            transaction.update(sendDoc.ref, { 잔액: FieldValue.increment(amount) });

            const historyRef = db.collection('TransactionHistory');
            transaction.set(historyRef.doc(), {
                uid,
                계좌번호: myAccountNumber,
                거래상대: sendData.회원계좌명,
                거래금액: -amount,
                잔액: myNewBalance,
                거래일시: formatDateTime(),
                거래유형: "송금(출금)"
            });

            transaction.set(historyRef.doc(), {
                uid: sendData.uid,
                계좌번호: targetAccountNumber,
                거래상대: myData.회원계좌명,
                거래금액: amount,
                잔액: sendNewBalance,
                거래일시: formatDateTime(),
                거래유형: "송금(입금)"
            });
        });

        res.json({ message: "송금 완료" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error });
    }
});

// 거래내역 조회 API
router.get('/history', async (req, res) => {
    const { uid, accountNumber } = req.query;

    if (!uid || !accountNumber) {
        return res.status(400).json({ error: "잘못된 요청입니다." });
    }

    try {
        const q = await db.collection('TransactionHistory')
            .where('uid', '==', uid)
            .where('계좌번호', '==', accountNumber)
            .get();

            const history = q.docs.map(doc => doc.data());
            history.sort((a, b) => b.거래일시.localeCompare(a.거래일시));

            res.json(history);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "조회 실패"});
    }
});

module.exports = router;