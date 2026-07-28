/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Gig, User } from './types';

export const INITIAL_USER: User = {
  fullName: 'Alex Johnson',
  email: 'alex.j@neighborhood.co',
  phoneNumber: '+91 98765 43210',
  isVerified: false,
  avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBzc_hTu9CT9r1Zj8Mb9J9gyeZSdQZUbtn5FDXvW5NfEWUMGzJu1iVMOI4MvaDHbiKOrQbcGq7EGOc5Cp9bIg6-lJP89lisPpJCbNhApkIJEP4ZHmtZe4-sjx0hl5FuUpdc9PyR_yp4UOBzhvInxbn2vNnTtQLm8z1hvoJPs0J1bybTyFsk4uMQzP7-4SYXQs1dPNyDZ4wADUBUARxzhOHV1LdMoxtDr2qzDReMXXNybOhStPb4wrtH8_XgHEpJXUCX61d5wWY9sw', // Alex Johnson
  gigsDone: 28,
  gigsPosted: 15,
};

export const INITIAL_GIGS: Gig[] = [];
