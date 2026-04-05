# Deployment History Feature - Testing Checklist

## Prerequisites
- [ ] Application is running (Docker or local)
- [ ] Connected to a Kubernetes cluster with deployments
- [ ] AWS SSO logged in (if using AWS EKS)

## Basic Tab Functionality
- [ ] Navigate to `/dashboard-local`
- [ ] Select a namespace with services
- [ ] Click on a service row to expand it
- [ ] Verify tabs are visible: "Pods" and "Deployment History"
- [ ] "Pods" tab is active by default
- [ ] Click "Deployment History" tab
- [ ] Tab switches correctly with visual feedback

## Pods Tab
- [ ] Pods tab shows loading state initially
- [ ] Pods load successfully
- [ ] Pod cards display correctly with:
  - [ ] Pod name
  - [ ] Status badge
  - [ ] CPU/Memory usage bars
  - [ ] Node, IP, Age, Restarts metadata
- [ ] Click pod name links to Humio logs (if configured)

## Deployment History Tab
- [ ] Deployment History tab shows loading state
- [ ] History loads successfully
- [ ] Table displays with columns:
  - [ ] Revision number
  - [ ] Image (in code block)
  - [ ] Age (human-readable: Xd, Xh, Xm, Xs)
  - [ ] Change Cause
  - [ ] Action (Rollback button or empty for current)
- [ ] Current revision has "CURRENT" badge
- [ ] Current revision has no rollback button
- [ ] Non-current revisions have orange "Rollback" button

## Rollback Modal
- [ ] Click "Rollback" button on non-current revision
- [ ] Modal appears with:
  - [ ] Warning message
  - [ ] Comparison grid showing current → target image
  - [ ] Confirmation input field
  - [ ] Cancel and Rollback buttons
- [ ] Rollback button is disabled initially
- [ ] Type incorrect deployment name → button stays disabled
- [ ] Type correct deployment name → button becomes enabled
- [ ] Click outside modal → modal closes
- [ ] Click "Cancel" → modal closes

## Rollback Execution
- [ ] Click "Rollback" with correct deployment name
- [ ] Button shows "Rolling back..." and is disabled
- [ ] Request completes successfully
- [ ] Success notification appears
- [ ] Modal closes
- [ ] After 2 seconds, deployment history reloads
- [ ] New current revision is highlighted
- [ ] Previous current revision now has rollback button

## Error Handling
- [ ] Test with non-existent deployment → shows error message
- [ ] Test with AWS auth expired → shows friendly error
- [ ] Test rollback with invalid revision → shows error notification
- [ ] Network error during load → shows error state

## UI/UX
- [ ] Tab buttons have hover effects
- [ ] Active tab has cyan underline
- [ ] Rollback button has hover effect (glow)
- [ ] Modal has blur backdrop
- [ ] Modal content has orange border
- [ ] Table rows have hover state
- [ ] Loading spinners are visible and animated

## Cross-Browser Testing
- [ ] Chrome/Chromium
- [ ] Firefox
- [ ] Safari

## Responsive Design
- [ ] Desktop (1920px)
- [ ] Laptop (1366px)
- [ ] Tablet (768px)
- [ ] Mobile (375px)

## Edge Cases
- [ ] Deployment with 0 revisions
- [ ] Deployment with 1 revision (only current)
- [ ] Deployment with 10+ revisions
- [ ] Very long image names (wrapping)
- [ ] Missing change cause annotation
- [ ] Switching tabs rapidly
- [ ] Expanding multiple services simultaneously
- [ ] Collapse and re-expand service

## Performance
- [ ] Tab switching is instant
- [ ] Loading states appear immediately
- [ ] No console errors
- [ ] No memory leaks after multiple operations

## Accessibility
- [ ] Tab buttons are keyboard navigable
- [ ] Tab buttons have aria-labels
- [ ] Modal can be closed with Escape key (if implemented)
- [ ] Focus management in modal

## Integration
- [ ] Works with existing incremental updates
- [ ] State persists when service list refreshes
- [ ] Works with different namespaces
- [ ] Works with different contexts
- [ ] Works in both local and cluster mode (if applicable)
