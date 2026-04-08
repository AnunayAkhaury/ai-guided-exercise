type UserProfile = {
    role: string;
    username: string;
    fullname: string;
    email: string | null;
    createdAt: Date;
    updatedAt: Date;
};
export declare function createProfile(uid: string, role: string, username: string, fullname: string, email?: string): Promise<UserProfile>;
export declare function getProfile(uid: string): Promise<{
    role: any;
    username: any;
    fullname: any;
    email: any;
    createdAt: any;
    updatedAt: any;
} | null>;
export {};
//# sourceMappingURL=firebase-auth.d.ts.map