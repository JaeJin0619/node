const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

const db = admin.firestore();

// 매일 자정 자동 실행 - 삭제된지 14일 지난 의뢰서 DeletedRequest로 이동
exports.expireDeletedRequests = functions.pubsub
    .schedule('0 0 * * *')  // 매일 0시에 실행
    .timeZone('Asia/Seoul')
    .onRun(async (context) => {
        const now = Date.now();
        const EXPIRE_MS = 14* 24 * 60 * 60 * 1000; // 14일

        try {
            const snapshot = await db.collection('Request')
                .where('status', '==', 5)
                .get();

            if ( snapshot.empty) {
                console.log('만료 처리할 의뢰서 없음');
                return null;
            }

            let count = 0;

            for (const doc of snapshot.docs) {
                const data =doc.data();
                const deletedAt = data.deleted_at_timestamp;

                if (deletedAt && (now - deletedAt) >= EXPIRE_MS) {
                    const batch = db.batch();

                    // 1. 컬렉션 복사
                    const archiveRef = db.collection('DeletedRequest').doc(doc.id);
                    batch.set(archiveRef, {
                        ...data,
                        status: 9,
                        archived_at: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
                        archived_at_timestamp: now,
                        original_id: doc.id
                    });

                    // 원본 문서 삭제
                    batch.delete(doc.ref);

                    await batch.commit();
                    count++;
                }
            }

            if (count > 0) {
                console.log(`${count}개 의뢰서를 DeletedRequest 컬렉션으로 이동 완료`);
            } else {
                console.log('만료된 의뢰서 없음');
            }

            return null;
        } catch (error) {
            console.error('만료 처리 실패:', error);
            return null;
        }
    });