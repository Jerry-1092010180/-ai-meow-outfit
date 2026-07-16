import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ROUTES } from '@/config/routes';
import { useUserStore } from '@/stores/useUserStore';
import Loading from '@/components/common/Loading';
import Toast from '@/components/common/Toast';

const HomePage = lazy(() => import('@/pages/HomePage'));
const DailyQuestPage = lazy(() => import('@/pages/DailyQuestPage'));
const OnboardingPage = lazy(() => import('@/pages/OnboardingPage'));
const DiaryPage = lazy(() => import('@/pages/DiaryPage'));
const ChallengeListPage = lazy(() => import('@/pages/ChallengeListPage'));
const ChallengeDetailPage = lazy(() => import('@/pages/ChallengeDetailPage'));
const SharePage = lazy(() => import('@/pages/SharePage'));
const TryOnPage = lazy(() => import('@/pages/TryOnPage'));
const Challenge3DPage = lazy(() => import('@/pages/Challenge3DPage'));
const JoinChallengePage = lazy(() => import('@/pages/JoinChallengePage'));
const StorePage = lazy(() => import('@/pages/StorePage'));
const ProfilePage = lazy(() => import('@/pages/ProfilePage'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Loading variant="spinner" />
    </div>
  );
}

function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const isOnboarded = useUserStore((s) => s.isOnboarded);
  if (!isOnboarded) {
    return <Navigate to={ROUTES.ONBOARDING} replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path={ROUTES.ONBOARDING} element={<OnboardingPage />} />
          {/* Competition demo and friend-collaboration links must open without onboarding. */}
          <Route path={ROUTES.GAME} element={<DailyQuestPage />} />
          <Route path={ROUTES.HOME} element={<Navigate to={ROUTES.GAME} replace />} />
          <Route
            path={ROUTES.OUTFIT}
            element={
              <OnboardingGuard>
                <HomePage />
              </OnboardingGuard>
            }
          />
          <Route
            path={ROUTES.DIARY}
            element={
              <OnboardingGuard>
                <DiaryPage />
              </OnboardingGuard>
            }
          />
          <Route
            path={ROUTES.CHALLENGES}
            element={
              <OnboardingGuard>
                <ChallengeListPage />
              </OnboardingGuard>
            }
          />
          <Route
            path={ROUTES.CHALLENGE_DETAIL}
            element={
              <OnboardingGuard>
                <ChallengeDetailPage />
              </OnboardingGuard>
            }
          />
          <Route
            path={ROUTES.SHARE}
            element={
              <OnboardingGuard>
                <SharePage />
              </OnboardingGuard>
            }
          />
          <Route
            path={ROUTES.TRY_ON}
            element={
              <OnboardingGuard>
                <TryOnPage />
              </OnboardingGuard>
            }
          />
          <Route
            path={ROUTES.CHALLENGE_3D}
            element={
              <OnboardingGuard>
                <Challenge3DPage />
              </OnboardingGuard>
            }
          />
          {/* 邀请链接 — 公开访问（被邀请者可能还没注册） */}
          <Route
            path={ROUTES.JOIN_CHALLENGE}
            element={<JoinChallengePage />}
          />
          <Route
            path={ROUTES.STORE}
            element={
              <OnboardingGuard>
                <StorePage />
              </OnboardingGuard>
            }
          />
          <Route
            path={ROUTES.PROFILE}
            element={
              <OnboardingGuard>
                <ProfilePage />
              </OnboardingGuard>
            }
          />
          <Route path="*" element={<Navigate to={ROUTES.GAME} replace />} />
        </Routes>
      </Suspense>
      <Toast />
    </>
  );
}
