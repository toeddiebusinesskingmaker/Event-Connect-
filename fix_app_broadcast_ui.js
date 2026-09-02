import fs from 'fs';

let code = fs.readFileSync('src/App.tsx', 'utf8');

const target = /\{\/\* Event QR Code Sharing Card \*\/\}/;
const newUI = `{/* Broadcast Message Card */}
                  <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 flex flex-col gap-3">
                    <div>
                      <span className="text-[9px] font-bold text-sky-700 uppercase tracking-wider block mb-0.5">Attendee Engagement</span>
                      <h4 className="font-bold text-xs text-sky-950">Send Announcement</h4>
                      <p className="text-[10px] text-sky-800/80 mt-0.5">Push a notification to all currently checked-in attendees instantly.</p>
                    </div>
                    <form onSubmit={handleSendBroadcast} className="flex flex-col gap-2">
                      <textarea 
                        rows={2}
                        placeholder="Type your announcement here..."
                        value={broadcastInput}
                        onChange={(e) => setBroadcastInput(e.target.value)}
                        className="w-full bg-white border border-sky-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 resize-none text-slate-800"
                        maxLength={200}
                      />
                      <button 
                        type="submit"
                        disabled={isSendingBroadcast || !broadcastInput.trim()}
                        className="self-end bg-sky-700 hover:bg-sky-800 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-lg text-[10px] uppercase tracking-wider transition shadow-sm"
                      >
                        {isSendingBroadcast ? 'Sending...' : 'Send Broadcast'}
                      </button>
                    </form>
                  </div>

                  {/* Event QR Code Sharing Card */}`;

code = code.replace(target, newUI);

fs.writeFileSync('src/App.tsx', code);
console.log('src/App.tsx UI updated');
