# Browser port status

NSM Offline runs original New Star Manager 1.7.7 (57) DEX instructions in a browser VM/JIT, with a GLES2/WebGL graphics bridge. It is a separate project from NSS Offline and does not emulate Android.

The original title, stadium/career home, animated assistant, training pitch and players have been inspected in a real browser. Passing, passes into space, teammate run paths and passing into paths have been exercised through browser input. The user confirmed successful startup on a physical iPhone after the startup and touch fixes. Temporary startup debugging has been removed.

Full match completion, long-term career progression, valid completed-career reload and physical-phone performance still require broader validation. The current tests cover host dispatch, input, startup ordering, saves, offline caching and resource ownership; they do not establish complete gameplay compatibility.

See [implementation notes](BROWSER_PORT.md) for runtime boundaries and [the original static assessment](FEASIBILITY.md) for investigation evidence.
