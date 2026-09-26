const housingPages = [
  'Browse listings',
  'Saved listings',
  'Enquiries',
  'My profile',
];

const flatmatePages = [
  'Flatmate matches',
  'Saved flatmates',
  'Enquiries',
  'My profile',
];

const advertiserPages = [
  'Dashboard',
  'My listings',
  'Create listing',
  'Enquiries',
  'My profile',
];

const adminPages = [
  'Dashboard',
  'Admin dashboard',
];

export function getAccountPages(user) {
  if (!user) return [];

  if (user.role === 'student') {
    return user.student_type === 'flatmate'
      ? flatmatePages
      : housingPages;
  }

  if (user.role === 'advertiser') {
    return advertiserPages;
  }

  if (user.role === 'admin') {
    return adminPages;
  }

  return [];
}

export function getDefaultPage(user) {
  return getAccountPages(user)[0] || 'Dashboard';
}

export function resolveAccountPage(user, requestedPage) {
  const pages = getAccountPages(user);

  if (pages.includes(requestedPage)) {
    return requestedPage;
  }

  // Listing details are opened from housing search or saved listings.
  if (
    user?.role === 'student' &&
    user.student_type !== 'flatmate' &&
    requestedPage === 'Listing detail'
  ) {
    return requestedPage;
  }

  return getDefaultPage(user);
}