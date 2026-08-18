"use client";

import React from 'react';

import { MomentAIGuestFlowController } from '@/components/momentai-guest-flow/momentai-guest-flow-controller';

import { getWindowMiniGuestViewModel } from '../state/windowmini-guest-view-model';

export function WindowMiniGuestShell() {
  void getWindowMiniGuestViewModel();

  return <MomentAIGuestFlowController />;
}
