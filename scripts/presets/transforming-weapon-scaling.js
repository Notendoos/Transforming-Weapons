const transformingWeaponScaling = {
  id: "transforming-weapon-scaling",
  label: "Transforming Weapon Scaling",
  defaultForm: "assembled",
  defaultState: "active",
  counters: {
    resource: {
      current: 0,
      max: 0
    }
  },
  timers: {
    restoreAt: null,
    startedAt: null
  },
  forms: {
    assembled: {
      label: "Assembled Form",
      attackBonus: 1,
      damageFormula: "1d6 + @mod",
      damageType: "bludgeoning"
    },
    fragmented: {
      label: "Fragmented Form",
      attackBonus: 1,
      damageFormula: "1d4",
      damageType: "piercing"
    },
    stick: {
      label: "Stick Form",
      attackBonus: 0,
      damageFormula: "1d4",
      damageType: "bludgeoning"
    }
  },
  states: {
    active: {
      label: "Active"
    },
    restoring: {
      label: "Restoring"
    }
  },
  passives: {
    undeadGlow: {
      label: "Blue shimmer near undead",
      type: "proximityCue"
    },
    fiendGlow: {
      label: "Red shimmer near fiends",
      type: "proximityCue"
    }
  },
  restrictions: {
    stickSwapCost: {
      label: "Switching away from the stick form costs a bonus action.",
      when: {
        form: "stick"
      },
      effect: {
        type: "equipCost",
        cost: "bonusAction"
      }
    }
  },
  actions: {
    transform: {
      label: "Transform",
      availableWhen: {
        form: "assembled",
        state: "active"
      },
      effects: [
        {
          type: "rollToCounter",
          formula: "1d10 + @details.level",
          target: "counters.resource"
        },
        {
          type: "transitionForm",
          to: "fragmented"
        }
      ]
    },
    restore: {
      label: "Restore",
      availableWhen: {
        forms: ["fragmented", "stick"],
        state: "active"
      },
      effects: [
        {
          type: "startTimer",
          durationSeconds: 3600,
          startedAt: "timers.startedAt",
          endsAt: "timers.restoreAt"
        },
        {
          type: "transitionState",
          to: "restoring"
        }
      ]
    }
  },
  triggers: {
    onSuccessfulHit: [
      {
        fromForms: ["fragmented"],
        fromStates: ["active"],
        effects: [
          {
            type: "decrementCounter",
            path: "counters.resource.current",
            amount: 1
          },
          {
            type: "transitionFormIf",
            condition: "@rule.counters.resource.current <= 0",
            to: "stick"
          }
        ]
      }
    ],
    onWorldTimeUpdate: [
      {
        fromStates: ["restoring"],
        condition: "@world.time >= @rule.timers.restoreAt",
        effects: [
          {
            type: "resetCounter",
            path: "counters.resource"
          },
          {
            type: "clearPath",
            path: "timers.startedAt"
          },
          {
            type: "clearPath",
            path: "timers.restoreAt"
          },
          {
            type: "transitionForm",
            to: "assembled"
          },
          {
            type: "transitionState",
            to: "active"
          }
        ]
      }
    ]
  },
  ui: {
    summary: "Generate a temporary resource pool, consume it on confirmed hits, then restore after one hour."
  }
};

export default transformingWeaponScaling;
