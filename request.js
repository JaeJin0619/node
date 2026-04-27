const express = require('express');
const router = express.Router();
const { db } = require('../firebase');


function formatDateTime(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${year}년 ${month}월 ${day}일 ${hour}시 ${min}분`;
}

// 의뢰서 등록
router.post('/register', async (req, res) => {
    const {
        uid,
        customer_phone,
        customer_address,
        customer_address_detail,
        clientName,
        brand,
        aircon_type,
        service_type,
        service_date,
        service_time,
        detailInfo
    } = req.body;

if (!customer_phone) return res.status(400).json({ error: "고객 전화번호는 필수입니다." });
if (!customer_address) return res.status(400).json({ error: "고객 주소는 필수입니다" });
if (!brand) return res.status(400).json({ error: "에어컨 브랜드는 필수입니다." });
if (!aircon_type) return res.status(400).json({ error: "에어컨 유형은 필수입니다." });
if (!service_type) return res.status(400).json({ error: "서비스 유형은 필수입니다." });
if (!service_date) return res.status(400).json({ error: "서비스 희망 날짜는 필수입니다." });

try {
    const docRef = await db.collection('Request').add({
        uid,
        customer_phone,
        customer_address,
        customer_address_detail: customer_address_detail || "",
        clientName: clientName || "",
        brand,
        aircon_type,
        service_type,
        service_date,
        service_time: service_time || "",
        detailInfo: detailInfo || "",
        status: 1,
        created_at: formatDateTime()
        });


        res.status(201).json({
            message: "의뢰서가 등록되었습니다.",
            request_id: docRef.id
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "의뢰서 등록 실패" });
    }
});

// 의뢰서 목록 조회
router.get('/list', async (req, res) => {
    const { uid } = req.query;
    if (!uid) return res.status(400).json({ error: "uid가 필요합니다." });
 
    try {
        const snapshot = await db.collection('Request').where('uid', '==', uid).get();
 
        const requests = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(r => r.status !== 5 && r.status !== 9); 
 
        requests.sort((a, b) => b.created_at.localeCompare(a.created_at));
        res.status(200).json({ requests });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "목록 조회 실패" });
    }
});

// 의뢰서 단건 조회
router.get('/detail/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const doc = await db.collection('Request').doc(id).get();
        if (!doc.exists) return res.status(404).json({ error: "의뢰서를 찾을 수 없습니다." });

        res.status(200).json({ request: { id: doc.id, ...doc.data() } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "의뢰서 조회 실패" });
    }
});

// 의뢰서 수정
router.put('/update/:id', async (req, res) => {
    const { id } = req.params;
    const {
        customer_phone,
        customer_address,
        customer_address_detail,
        clientName,
        brand,
        aircon_type,
        service_type,
        service_date,
        service_time,
        detailInfo
    } = req.body;

    if (!customer_phone) return res.status(400).json({ error: "고객 전화번호는 필수입니다." });
    if (!customer_address) return res.status(400).json({ error: "고객 주소는 필수입니다." });
    if (!brand) return res.status(400).json({ error: "에어컨 브랜드는 필수입니다." });
    if (!aircon_type) return res.status(400).json({ error: "에어컨 유형은 필수입니다." });
    if (!service_type) return res.status(400).json({ error: "서비스 유형은 필수입니다." });
    if (!service_date) return res.status(400).json({ error: "서비스 희망 날짜는 필수입니다." });

    try {
        const docRef = db.collection('Request').doc(id);
        const doc = await docRef.get();
        if (!doc.exists) return res.status(404).json({ error: "의뢰서를 찾을 수 없습니다." });

        await docRef.update({
            customer_phone,
            customer_address,
            customer_address_detail: customer_address_detail || "",
            clientName: clientName || "",
            brand,
            aircon_type,
            service_type,
            service_date,
            service_time: service_time || "",
            detailInfo: detailInfo || "",
            updated_at: formatDateTime()
        });

        res.status(200).json({ message: "의뢰서가 수정되었습니다." });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "의뢰서 수정 실패" });
    }
});

// 의뢰서 삭제 기능
router.put('/delete/:id', async (req, res) => {
    const { id } = req.params;
    const { uid } = req.body;

    if (!uid) return res.status(400).json({ error: "uid가 필요합니다." });

    try {
        const docRef = db.collection('Request').doc(id);
        const doc = await docRef.get();
        if (!doc.exists) return res.status(404).json({ error: "의뢰서를 찾을 수 없습니다." });
        if (doc.data().uid !== uid) return res.status(403).json({ error: "본인의 의뢰서만 삭제할 수 있습니다. "});

        await docRef.update({
            status: 5,
            deleted_at: formatDateTime(),
            deleted_at_timestamp: Date.now()
        });

        res.status(200).json({ message: "의뢰서가 삭제되었습니다. 14일 이내 복구 가능합니다." });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "의뢰서 삭제 실패" });
    }
});

// 삭제된 의뢰서 목록 조회
router.get('/deleted', async (req, res) => {
    const { uid } = req.query;
    if (!uid) return res.status(400).json({ error: "uid가 필요합니다." });

    try {
        const snapshot = await db.collection('Request')
            .where('uid', '==', uid)
            .where('status', '==', 5)
            .get();

            const requests = snapshot.docs.map(doc => {
                const data = doc.data();
                const deletedDate = new Date(data.deleted_at_timestamp);
                const expireDate = new Date(deletedDate.getTime() + 14 * 24 * 60 * 60 * 1000);
                const remainDays = Math.ceil((expireDate - new Date()) / (1000 * 60 * 60 * 24));
                return { id: doc.id, ...data, remainDays: Math.max(remainDays, 0) };
            });

            requests.sort((a, b) => b.deleted_at_timestamp - a.deleted_at_timestamp);
            res.status(200).json({ requests });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "삭제 목록 조회 실패" });
    }
});

// 의뢰서 복구 
router.put('/restore/:id', async (req, res) => {
    const { id } = req.params;
    const { uid } = req.body;

    if (!uid) return res.status(400).json({ error: "uid가 필요합니다." });

    try {
        const docRef = db.collection('Request').doc(id);
        const doc = await docRef.get();
        if (!doc.exists) return res.status(404).json({ error: "의뢰서를 찾을 수 없습니다." });
        if (doc.data().uid !== uid) return res.status(403).json({ error: "본인의 의뢰서만 복구할 수 있습니다." });
        if (doc.data().status !== 5) return res.status(400).json({ error: "삭제된 의뢰서만 복구할 수 있습니다." });

        // 14일
        const deletedAt = doc.data().deleted_at_timestamp;
        const expired = Date.now() - deletedAt > 14 * 24 * 60 * 60 * 1000;
        if (expired) return res.status(400).json({ error: "복구 가능 기간(14일)이 만료되었습니다." });

        await docRef.update({
            status: 1,
            deleted_at: null,
            deleted_at_timestamp: null,
            restored_at: formatDateTime()
        });

        res.status(200).json({ message: "의뢰서가 복구되었습니다." });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "의뢰서 복구 실패" });
    }
})
module.exports = router;