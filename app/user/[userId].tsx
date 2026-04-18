import { useLocalSearchParams, useRouter } from 'expo-router';
import UserProfile from '../../components/UserProfile';

export default function UserProfileScreen() {
    const { userId: targetId } = useLocalSearchParams<{ userId: string }>();
    const router = useRouter();

    return (
        <UserProfile
            targetUserId={Number(targetId)}
            onBack={() => router.back()}
        />
    );
}
