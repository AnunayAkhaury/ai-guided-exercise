import { db } from '@/services/Firebase/firebase-service.js';
import { Timestamp } from 'firebase-admin/firestore';
import nodemailer from 'nodemailer';
import crypto from 'crypto';

const APPROVAL_REQUESTS_COLLECTION = 'approval_requests';
const USER_COLLECTION = 'users';

type ApprovalDoc = {
  token: string;
  userId: string;
  expiresAt: Timestamp;
  used: boolean;
};

export function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

export async function addApprovalRequestEntry(userId: string, token: string) {
  try {
    const expiresAt = Timestamp.fromDate(new Date(Date.now() + 24 * 60 * 60 * 1000));
    const approvalDoc: ApprovalDoc = {
      token,
      userId,
      expiresAt: expiresAt,
      used: false
    };
    await db.collection(APPROVAL_REQUESTS_COLLECTION).doc().set(approvalDoc);
  } catch (error) {
    throw error;
  }
}

export async function createApprovalRequest(userId: string, userEmail: string, userName: string) {
  const backendUrl = process.env.BACKEND_URL;
  const mailServerEmail = process.env.MAIL_SERVER_EMAIL;
  const appPassword = process.env.GOOGLE_APP_PASSWORD;
  const supervisorEmail = process.env.SUPERVISOR_EMAIL;
  try {
    if (!backendUrl || !mailServerEmail || !appPassword || !supervisorEmail) {
      throw new Error(
        'Missing one or more environment variables [BACKEND_URL, MAIL_SERVER_EMAIL, GOOGLE_APP_PASSWORD].'
      );
    }
    if (!userEmail || !userId) {
      throw new Error('Missing userEmail or userId.');
    }

    const token = generateToken();

    const approveUrl = `${backendUrl}/api/verification/verifyEmail/${token}`;
    const content = `
        A new user has requested access to the application.

        User Details:
        - Email: ${userEmail}
        - Username: ${userName}

        To approve this user, visit:
        ${approveUrl}

        If you were not expecting this request, you can ignore this email.
        If 24 hours passed since the request, please ask the student/instructor to resend the request.
        `;

    const subject = 'ACTION REQUIRED: Verify New User Registration';
    await sendEmail(supervisorEmail, subject, content);
    await addApprovalRequestEntry(userId, token);
  } catch (err: any) {
    throw err;
  }
}

export async function sendEmail(to: string, subject: string, content: string) {
  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.MAIL_SERVER_EMAIL,
        pass: process.env.GOOGLE_APP_PASSWORD
      }
    });

    const info = await transporter.sendMail({
      from: process.env.MAIL_SERVER_EMAIL,
      to,
      subject: subject,
      text: content
    });

    return info;
  } catch (error) {
    throw error;
  }
}

export async function verifyAccount(userId: string): Promise<boolean> {
  try {
    const querySnapshot = await db.collection(USER_COLLECTION).where('userId', '==', userId).limit(1).get();

    if (querySnapshot.empty) {
      return false;
    }

    const doc = querySnapshot.docs[0];
    if (!doc) {
      throw new Error('User not found.');
    }
    const data = doc.data();

    return data.verified === true;
  } catch (error) {
    throw error;
  }
}

export async function setVerified(token: string) {
  try {
    const querySnapshot = await db.collection(APPROVAL_REQUESTS_COLLECTION).where('token', '==', token).limit(1).get();

    if (querySnapshot.empty) {
      throw new Error('Invalid token');
    }

    const approvalSnapshot = querySnapshot.docs[0];

    if (!approvalSnapshot) {
      throw new Error('Token not found');
    }

    const approvalDoc = approvalSnapshot.data() as ApprovalDoc;

    if (approvalDoc.used) {
      throw new Error('Token already used');
    }

    if (approvalDoc.expiresAt.toDate() < new Date()) {
      throw new Error('Token expired');
    }

    await db.collection(USER_COLLECTION).doc(approvalDoc.userId).update({
      verified: true
    });

    await approvalSnapshot.ref.update({
      used: true,
      usedAt: new Date()
    });
  } catch (error) {
    throw error;
  }
}

export async function getUserVerificationStatus(uid: string): Promise<boolean> {
  try {
    const userRef = db.collection(USER_COLLECTION).doc(uid);
    const snapshot = await userRef.get();

    if (!snapshot.exists) {
      throw new Error('User not found');
    }

    const data = snapshot.data();

    if (!data) {
      throw new Error('User data not found');
    }

    return data?.verified === true;
  } catch (error) {
    throw error;
  }
}
