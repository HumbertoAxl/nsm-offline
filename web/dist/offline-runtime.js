// NSM-specific offline policy. The original local configuration, preload,
// interface, career logic and save serialization remain in the DEX runtime.
const P = 'Luk/fiveaces/nsfc/';
const type = name => P + name + ';';
const SETUP_BUDGET = 500_000_000;

function field(vm, owner, name) {
  const id = vm.dex.fields.findIndex(f => f[0] === type(owner) && f[1] === name);
  if (id < 0) throw new Error(`Missing NSM field ${owner}.${name}`);
  return vm.fieldIds[id];
}
function get(vm, owner, name, self = null) {
  const id = field(vm, owner, name);
  return vm.unpack(vm.dex.fields[id][2], self ? self.$fields.get(id) : vm.statics.get(id));
}
function set(vm, owner, name, value, self = null) {
  const id = field(vm, owner, name);
  (self ? self.$fields : vm.statics).set(id, vm.pack(vm.dex.fields[id][2], value));
}

export function installOfflineRuntime(vm) {
  const remove = [];
  const override = (owner, signature, callback) => {
    remove.push(vm.installOverride(type(owner), signature, callback));
  };
  const call = (owner, method, args = []) => vm.call(type(owner), method, args);

  override('c_TScreen_CloudSetup', `m_SetUpScreen(${type('c_Transition_Base')})I`, () => {
    const catalogue = call('c_CatalogueManager', 'm_Get');
    call('c_CatalogueManager', 'p_Setup', [catalogue]);
    call('c_DLCService', 'm_SetLocalDLCPath', [get(vm, 'c_TScreen_CloudSetup', 'm_assetsPath')]);
    // A blank server path is never requested; bundled catalogue paths remain valid.
    call('c_DLCService', 'm_SetServerPath', ['']);
    set(vm, 'c_TScreen_CloudSetup', 'm_cloudFlowInProgress', false);
    set(vm, 'c_TScreen_CloudSetup', 'm_waitingForFuse', false);
    set(vm, 'c_Cloud', 'm_mustFinishUpdating', false);
    // Keep the original preload screen and its completion callback, plus FTUE.
    return call('c_TScreen_CloudSetup', 'm_MoveOnToGame');
  });
  override('c_TScreen_CloudSetup', 'm_LaunchCloud()V', () => 0);
  override('c_TScreen_CloudSetup', 'm_Update()I', () => 0);
  override('c_Cloud', 'm_HasGameConfigurationValue(Ljava/lang/String;)Z', () => false);

  override('c_GameEngine', 'p_InitialiseAPIs()V', ({self}) => {
    // Do not replace this with an empty method: bundled tweaks use FakeConfig.
    let config = vm.newObject(type('c_FakeConfigComponent'));
    config = call('c_FakeConfigComponent', 'm_FakeConfigComponent_new', [config]);
    call('c_FakeConfigComponent', 'p_Activate', [config, 5]);
    const hub = call('c_SocialHub', 'm_Instance2');
    call('c_SocialHub', 'p_Add11', [hub, config]);
    set(vm, 'c_GameEngine', 'm_apisInitialised', true, self);
    return 0;
  });
  override('c_GameEngine', 'p_RefreshRemoteConfiguration()V', () => {
    call('c_Tweaks', 'm_ReparseFromService');
    return 0;
  });
  override('c_GameEngine', 'm_CreateIAPs()V', () => 0);
  override('c_GameEngine', 'p_ManageConsent()I', () => 0);
  override('c_GameEngine', 'p_ManageConsentAdMob()I', () => 0);
  override('c_GameEngine', 'p_FirebaseSetConsent(Z)I', () => 0);
  // Method return types are read from DEX rather than assumed for this helper.
  for (const info of vm.methodInfo) {
    if (info.ref[0] === type('c_ConsentManager') && info.ref[1] === 'm_SetupIfNeeded') {
      override('c_ConsentManager', info.signature, () => 0);
    }
  }

  // Android finalizers eventually free an abandoned font atlas. Browser host
  // registries hold strong references, so the renderer must release its owned
  // atlas explicitly when fonts are unloaded or the renderer is rebuilt.
  const releaseFontAtlas = self => {
    const image = get(vm, 'c_FontRenderer', 'm_charImage', self);
    if (image) {
      // Original Discard refuses to destroy subimages backed by a shared source.
      vm.call(image.$class, 'p_Discard', [image, false]);
      set(vm, 'c_FontRenderer', 'm_charImage', null, self);
    }
  };
  override('c_FontRenderer', 'p_Shutdown()V', ({self, original}) => {
    const result = original();
    releaseFontAtlas(self);
    return result;
  });
  override('c_FontRenderer', 'p_Setup2(II)V', ({self, original}) => {
    releaseFontAtlas(self);
    return original();
  });
  // Large, bounded initialization/deserialization work gets a separate budget.
  // Ordinary frames still retain their normal budget and loop protection.
  const budgetMethods = new Map([
    ['c_GameEngine', new Set(['p_DoSetUp'])],
    // Original UI scripts expand nested macros when screens first open.
    ['c_GScreen', new Set(['p_Load'])],
    ['c_Language', new Set(['m_ParseFileUsingBuffer'])],
    ['c_TPlayer', new Set(['m_LoadCareer', 'p_SaveCareer', 'p_QuickSave'])],
    ['c_TCompetition', new Set(['m_LoadData', 'm_SetUpCompetitionsAll'])],
    ['c_TClub', new Set(['m_LoadData'])],
  ]);
  for (const info of vm.methodInfo) {
    const owner = info.ref[0].startsWith(P) ? info.ref[0].slice(P.length, -1) : '';
    if (budgetMethods.get(owner)?.has(info.ref[1]) && vm.find(info.ref[0], info.signature)) {
      override(owner, info.signature, ({original}) => vm.withInstructionBudget(SETUP_BUDGET, original));
    }
  }
  return () => { for (const undo of remove.reverse()) undo(); };
}

export function saveProgressCheckpoint(vm) {
  // Never advance simulation or serialize a career while a match is in progress.
  // The original serializer also checks end-of-season/debug/incomplete careers.
  const state = get(vm, 'c_GameEngine', 'm_gamestate');
  if (state !== 2) return false;
  const player = get(vm, 'bb_', 'g_player');
  return vm.withInstructionBudget(SETUP_BUDGET, () => {
    // The trial creates a temporary club before real competitions exist. A
    // forced save there passes p_SaveCareer's shallow date/id guard but cannot
    // pass the original load-time validation. Keep global preferences only.
    const club = player && get(vm, 'c_TPlayer', 'm_myclub', player);
    if (club && get(vm, 'c_GameSave', 'm_currentCareerData') &&
        vm.call(player.$class, 'p_ValidateClubAndCompData', [player]) === 1) {
      const inProgress = get(vm, 'bb_generated', 'g_tMatch_InProgress');
      if (!inProgress || vm.call(inProgress.$class, 'p_Output', [inProgress]) === 0) {
        vm.call(player.$class, 'p_SaveCareer', [player]);
        set(vm, 'c_GameSave', 'm_queueQuickSave', false);
      }
    }
    vm.call(type('c_TPlayer'), 'm_SaveGlobalData');
    return true;
  });
}

