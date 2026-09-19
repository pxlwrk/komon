import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/lib/auth';

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/anmelden');
  }

  const target = user.activeCommunityId
    ? user.communities.find((entry) => entry.communityId === user.activeCommunityId)
    : user.communities[0];

  redirect(target ? `/c/${target.communitySlug}` : '/communities');
}
