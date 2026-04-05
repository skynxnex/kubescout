/**
 * Kernel Panic Animation
 * Scrolling dmesg/kernel log lines rising from the bottom to the top.
 *
 * Text is amber (#ffb000) at low opacity (0.12–0.20) as a background effect.
 * Lines scroll upward continuously; new lines appear at the bottom.
 * Font: monospace, 10–11px.
 *
 * Runs at ~30 fps via setInterval (33 ms tick).
 */

let kernelCanvas  = null;
let kernelContext  = null;
let kernelAnimId   = null; // setInterval handle
let kernelLines    = [];   // active text lines on screen
let resizeHandler  = null;

// ---------------------------------------------------------------------------
// Kernel message pool — realistic dmesg lines
// ---------------------------------------------------------------------------

const KERNEL_MESSAGES = [
  '[    0.000000] Linux version 6.1.0-26 (gcc version 12.3.0 (Debian 12.3.0-1))',
  '[    0.000000] BIOS-provided physical RAM map:',
  '[    0.000000] BIOS-e820: [mem 0x0000000000000000-0x000000000009fbff] usable',
  '[    0.000000] ACPI: IRQ0 used by override',
  '[    0.000000] ACPI: IRQ9 used by override',
  '[    0.012345] ACPI: PM-Timer IO Port: 0x608',
  '[    0.023456] PCI: Using configuration type 1 for base access',
  '[    0.034567] clocksource: tsc-early: mask: 0xffffffffffffffff',
  '[    0.045678] Kernel/User page tables isolation: enabled',
  '[    0.056789] NET: Registered PF_INET protocol family',
  '[    0.067890] TCP established hash table entries: 65536 (order: 7, 524288 bytes)',
  '[    0.078901] TCP bind hash table entries: 65536 (order: 8, 1048576 bytes)',
  '[    0.089012] NET: Registered PF_INET6 protocol family',
  '[    0.100123] Initialise system trusted keyrings',
  '[    0.111234] workingset: timestamp_bits=46 max_order=20 bucket_order=0',
  '[    0.200345] SCSI subsystem initialized',
  '[    0.211456] usbcore: registered new interface driver usbfs',
  '[    0.222567] PCI: CLS 0 bytes, default 64',
  '[    0.300678] EXT4-fs (sda1): mounted filesystem with ordered data mode',
  '[    0.311789] VFS: Mounted root (ext4 filesystem) on device 8:1',
  '[    0.400890] clocksource: Switched to clocksource tsc',
  '[    0.411901] RCU Tasks Trace: Setting shift to 2 and lim to 0.9',
  '[    0.500012] systemd[1]: systemd v252.17-1 running in system mode',
  '[    0.600123] systemd[1]: Detected architecture x86-64',
  '[    0.700234] kernel: audit: type=1400 audit(1711234567.890:42): apparmor',
  '[    0.800345] kubelet: Starting kubelet with config: /etc/kubernetes/kubelet',
  '[    0.900456] kubelet: Node conditions: [Ready]',
  '[    1.000567] containerd: starting containerd daemon',
  '[    1.100678] containerd: loading plugin io.containerd.snapshotter.v1.overlayfs',
  '[    1.200789] containerd: containerd successfully booted in 0.340987s',
  '[    1.300890] kube-proxy: started with config /etc/kubernetes/proxy',
  '[    1.400901] kube-proxy: Setting iptables rules for svcCIDR 10.96.0.0/12',
  '[    2.000012] etcd: listening on https://0.0.0.0:2379',
  '[    2.100123] etcd: ready to serve client requests',
  '[    2.200234] kube-apiserver: listening on :6443',
  '[    2.300345] kube-apiserver: starting controller manager',
  '[    2.400456] kube-scheduler: starting kube-scheduler',
  '[    3.000567] systemd[1]: Started Kubernetes API Server.',
  '[    3.100678] systemd[1]: Started Kubernetes Scheduler.',
  '[    3.200789] systemd[1]: Started etcd key-value store.',
  '[    4.000890] audit: type=1400 audit(1711234571.123:99): apparmor=ALLOWED',
  '[    5.000901] oom_kill_process: Kill process 1337 (python) score 512',
  '[    5.100012] Out of memory: Killed process 1337 (python) total-vm:2048MB',
  '[    6.000123] kubelet: pod "my-service-5f9b4c-xkwz9" in ns "production" OOMKilled',
  '[    7.000234] EXT4-fs error (device sda1): ext4_find_entry:1455: inode #2',
  '[    8.000345] BUG: unable to handle kernel NULL pointer dereference',
  '[    8.100456] IP: ffffffff81247b60 kfree_skb+0x0/0xa0',
  '[    8.200567] PGD 0 P4D 0',
  '[    8.300678] Oops: general protection fault, maybe for address 0x0000dead',
  '[    8.400789] CPU: 3 PID: 31337 Comm: containerd Not tainted 6.1.0 #1',
  '[    8.500890] Hardware name: Amazon EC2 t3.large',
  '[    8.600901] RIP: 0010:kfree+0x1a/0x40',
  '[    8.700012] RSP: 0018:ffffc9000097bde8 EFLAGS: 00010246',
  '[    8.800123] RAX: 0000000000000000 RBX: ffff888003a5c000 RCX: 0000000000000000',
  '[    9.000234] Call Trace:',
  '[    9.100345]  <TASK>',
  '[    9.200456]  ? kfree+0x1a/0x40',
  '[    9.300567]  ? skb_free_head+0x27/0x50',
  '[    9.400678]  ? __kfree_skb+0x18/0x30',
  '[    9.500789]  ? consume_skb+0x2b/0xa0',
  '[    9.600890]  ? tcp_recvmsg_locked+0x4b1/0xba0',
  '[    9.700901]  ? tcp_recvmsg+0x5e/0x100',
  '[   10.000012] Kernel panic - not syncing: Fatal exception in interrupt',
  '[   10.100123] CPU: 3 PID: 31337 at kernel/sched/core.c:5895 scheduler_tick',
  '[   10.200234] ---[ end Kernel panic - not syncing: Fatal exception ]---',
  '[   10.300345] Rebooting in 5 seconds..',
  '[   15.000456] Linux version 6.1.0-26 (gcc version 12.3.0) -- rebooting',
  '[   15.100567] BIOS-provided physical RAM map:',
];

// ---------------------------------------------------------------------------
// Line management
// ---------------------------------------------------------------------------

const LINE_HEIGHT   = 14; // px between lines
const FONT_SIZE     = 10; // px
const SCROLL_SPEED  = 0.4; // px per frame upward
const LEFT_PADDING  = 12;

/**
 * Initialise the pool of lines to fill the screen from the bottom.
 */
function initLines() {
  kernelLines = [];
  const h = kernelCanvas ? kernelCanvas.height : window.innerHeight;
  const totalLines = Math.ceil(h / LINE_HEIGHT) + 5;

  for (let i = 0; i < totalLines; i++) {
    kernelLines.push({
      text:  KERNEL_MESSAGES[Math.floor(Math.random() * KERNEL_MESSAGES.length)],
      y:     h - (i * LINE_HEIGHT),
      alpha: 0.12 + Math.random() * 0.08, // 0.12–0.20
    });
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialize Kernel Panic animation.
 */
export function startKernelPanic() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  kernelCanvas = document.getElementById('kernelCanvas');
  if (!kernelCanvas) {
    kernelCanvas = document.createElement('canvas');
    kernelCanvas.id = 'kernelCanvas';
    kernelCanvas.style.position = 'fixed';
    kernelCanvas.style.top = '0';
    kernelCanvas.style.left = '0';
    kernelCanvas.style.width = '100%';
    kernelCanvas.style.height = '100%';
    kernelCanvas.style.zIndex = '-1';
    kernelCanvas.style.pointerEvents = 'none';

    const cyberBg = document.querySelector('.cyber-bg');
    if (cyberBg) {
      cyberBg.appendChild(kernelCanvas);
    } else {
      document.body.insertBefore(kernelCanvas, document.body.firstChild);
    }
  }

  kernelContext = kernelCanvas.getContext('2d');
  resizeKernelCanvas();
  initLines();

  resizeHandler = resizeKernelCanvas;
  window.addEventListener('resize', resizeHandler);

  startKernelLoop();
  console.log('[Kernel Panic] Animation started');
}

/**
 * Resize canvas and reinitialise lines.
 */
function resizeKernelCanvas() {
  if (!kernelCanvas) return;
  kernelCanvas.width  = window.innerWidth;
  kernelCanvas.height = window.innerHeight;
  initLines();
}

/**
 * Start the draw loop at ~30 fps.
 */
function startKernelLoop() {
  if (kernelAnimId) return;

  kernelAnimId = setInterval(() => {
    if (!kernelContext || !kernelCanvas) return;
    drawKernelFrame();
  }, 33);
}

/**
 * Draw one frame of scrolling kernel messages.
 */
function drawKernelFrame() {
  const w = kernelCanvas.width;
  const h = kernelCanvas.height;
  const ctx = kernelContext;

  // Clear canvas (background comes from CSS)
  ctx.clearRect(0, 0, w, h);

  ctx.font = `${FONT_SIZE}px 'Courier New', monospace`;

  let anyVisible = false;

  kernelLines.forEach(line => {
    // Scroll upward
    line.y -= SCROLL_SPEED;

    // If line has scrolled off the top, recycle it at the bottom
    if (line.y < -LINE_HEIGHT) {
      // Find the lowest current line y and place just below it
      const maxY = kernelLines.reduce((m, l) => Math.max(m, l.y), 0);
      line.y    = maxY + LINE_HEIGHT;
      line.text  = KERNEL_MESSAGES[Math.floor(Math.random() * KERNEL_MESSAGES.length)];
      line.alpha = 0.12 + Math.random() * 0.08;
    }

    if (line.y >= -LINE_HEIGHT && line.y <= h + LINE_HEIGHT) {
      anyVisible = true;
      ctx.fillStyle = `rgba(255, 176, 0, ${line.alpha})`;
      ctx.fillText(line.text, LEFT_PADDING, line.y);
    }
  });

  // Safety: if no lines visible (e.g. after resize), reinit
  if (!anyVisible) {
    initLines();
  }
}

/**
 * Stop the animation and clean up.
 */
export function stopKernelPanic() {
  if (kernelAnimId) {
    clearInterval(kernelAnimId);
    kernelAnimId = null;
  }

  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler);
    resizeHandler = null;
  }

  if (kernelContext && kernelCanvas) {
    kernelContext.clearRect(0, 0, kernelCanvas.width, kernelCanvas.height);
  }

  if (kernelCanvas && kernelCanvas.parentNode) {
    kernelCanvas.remove();
    kernelCanvas  = null;
    kernelContext = null;
  }

  kernelLines = [];
  console.log('[Kernel Panic] Animation stopped');
}

/**
 * Check if Kernel Panic animation is currently running.
 */
export function isKernelPanicActive() {
  return kernelAnimId !== null;
}
