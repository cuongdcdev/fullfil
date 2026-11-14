"use client";

import { useEffect, useState } from "react";
import { Button, Card } from "@/components/ui/kit";
import { friendlyError, v3, type UserProfile } from "@/lib/v3-client";

type Fields = Pick<UserProfile, "display_name" | "bio" | "contacts">;
const empty: Fields = { display_name: "", bio: "", contacts: {} };

export function ProfileEditor() {
  const [fields, setFields] = useState<Fields>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    v3.myProfile().then((profile) => {
      if (active) setFields(profile);
    }).catch((error) => {
      if (active) setMessage(friendlyError(error));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const updateContact = (key: keyof Fields["contacts"], value: string) =>
    setFields((current) => ({ ...current, contacts: { ...current.contacts, [key]: value } }));
  const fieldClass = "min-h-12 w-full rounded-lg border border-line bg-panel px-3 py-2";

  return (
    <section id="profile">
      <Card className="grid gap-4">
        <div>
          <h2 className="text-xl font-bold">Profile</h2>
          <p className="text-sm text-muted">Your contacts are shown only to the other person in an active order, so you can chat if needed.</p>
        </div>
        {loading ? <p className="text-sm text-muted">Loading profile…</p> : (
          <form className="grid gap-3" onSubmit={async (event) => {
            event.preventDefault();
            setSaving(true);
            setMessage("");
            try {
              setFields(await v3.saveMyProfile(fields));
              setMessage("Profile saved.");
            } catch (error) {
              setMessage(friendlyError(error));
            } finally {
              setSaving(false);
            }
          }}>
            <label className="grid gap-1 text-sm font-bold">Display name
              <input className={fieldClass} value={fields.display_name} maxLength={60} onChange={(event) => setFields({ ...fields, display_name: event.target.value })} />
            </label>
            <label className="grid gap-1 text-sm font-bold">About you
              <textarea className={fieldClass} value={fields.bio} maxLength={280} rows={3} onChange={(event) => setFields({ ...fields, bio: event.target.value })} />
              <span className="text-xs font-normal text-muted">{fields.bio.length}/280</span>
            </label>
            <label className="grid gap-1 text-sm font-bold">X handle
              <input className={fieldClass} value={fields.contacts.x ?? ""} onChange={(event) => updateContact("x", event.target.value)} placeholder="@example_handle" />
            </label>
            <label className="grid gap-1 text-sm font-bold">Telegram handle
              <input className={fieldClass} value={fields.contacts.telegram ?? ""} onChange={(event) => updateContact("telegram", event.target.value)} placeholder="@example_handle" />
            </label>
            <label className="grid gap-1 text-sm font-bold">Email
              <input className={fieldClass} type="email" value={fields.contacts.email ?? ""} onChange={(event) => updateContact("email", event.target.value)} placeholder="you@example.com" />
            </label>
            <Button type="submit" full disabled={saving}>{saving ? "Saving…" : "Save profile"}</Button>
            {message && <p className="text-sm" role="status">{message}</p>}
          </form>
        )}
      </Card>
    </section>
  );
}
