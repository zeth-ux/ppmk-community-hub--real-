"""Permission tests for supabase/migrations/0001_init.sql against a local
Postgres that imitates Supabase (auth.users, auth.uid(), anon/authenticated)."""
import glob, os, subprocess, sys, uuid
import psycopg2

DSN = dict(host=os.environ.get("PGHOST", "/home/claude/pgtest"), port=int(os.environ.get("PGPORT", 5499)), user="postgres")
MIGRATIONS = sorted(glob.glob(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "migrations", "*.sql")))
# MODE=new  -> Supabase 2026 behaviour: no automatic table grants
# MODE=old  -> older projects: automatic grants to anon/authenticated
MODE = os.environ.get("MODE", "new")

subprocess.run(["psql", "-h", DSN["host"], "-p", str(DSN["port"]), "-U", "postgres", "-qc", "drop database if exists hub"], check=True)
subprocess.run(["psql", "-h", DSN["host"], "-p", str(DSN["port"]), "-U", "postgres", "-qc", "create database hub"], check=True)
mock = os.path.join(os.path.dirname(os.path.abspath(__file__)), "mock_supabase.sql")
extra = [] if MODE == "new" else [os.path.join(os.path.dirname(os.path.abspath(__file__)), "mock_old_default_grants.sql")]
for f in [mock, *extra, *MIGRATIONS]:
    r = subprocess.run(["psql", "-h", DSN["host"], "-p", str(DSN["port"]), "-U", "postgres", "-d", "hub", "-q", "-v", "ON_ERROR_STOP=1", "-f", f], capture_output=True, text=True)
    if r.returncode:
        print(r.stderr); sys.exit("migration failed")
print(f"migrations applied cleanly (mode={MODE}): {[os.path.basename(m) for m in MIGRATIONS]}")

conn = psycopg2.connect(dbname="hub", **DSN)
conn.autocommit = True
fails = 0

def run(sql, uid=None, role="authenticated", args=None):
    """Run sql as a given user. Returns rows, or 'ERR: ...'."""
    cur = conn.cursor()
    try:
        cur.execute("begin")
        if role:
            cur.execute(f"set local role {role}")
        cur.execute("select set_config('request.jwt.claim.sub', %s, true)", (str(uid) if uid else "",))
        cur.execute(sql, args)
        rows = cur.fetchall() if cur.description else cur.rowcount
        cur.execute("commit")
        return rows
    except Exception as e:
        cur.execute("rollback")
        return "ERR: " + str(e).splitlines()[0]

def check(name, cond, got=None):
    global fails
    print(("PASS " if cond else "FAIL ") + name + ("" if cond else f"  -> got {got!r}"))
    fails += 0 if cond else 1

def is_err(r, text=""):
    return isinstance(r, str) and r.startswith("ERR") and text in r

def new_user(email):
    return run("insert into auth.users (email) values (%s) returning id", role=None, args=(email,))[0][0]

def complete(uid, sid, batch):
    return run("""update profiles set student_id=%s, full_name=%s, batch=%s, age=21,
                  phone='010-1234-5678', course='Computer Science', residence='Ansan', consent_at=now()
                  where id=auth.uid()""", uid, args=(sid, "Student " + sid, batch))

A  = new_user("admin@x.com")
O  = new_user("org@x.com")
S1 = new_user("s1@x.com")
S2 = new_user("s2@x.com")
S3 = new_user("s3@x.com")
run("update profiles set role='admin' where id=%s", role=None, args=(A,))  # bootstrap, like the SQL editor

check("signup trigger created 5 profiles", run("select count(*) from profiles", role=None)[0][0] == 5)
check("S1 completes own profile", complete(S1, "2024001", 2024) == 1)
r = run("update profiles set phone='010-9999-0000' where id=auth.uid() returning id, full_name, role", S1)
check("profile update with RETURNING works (what the app sends)", r == [(S1, "Student 2024001", "student")], r)
check("S2 completes own profile", complete(S2, "2025001", 2025) == 1)
complete(A, "2023001", 2023); complete(O, "2023002", 2023)

r = run("update profiles set role='admin' where id=auth.uid()", S1)
check("student cannot make themselves admin", is_err(r, "permission denied"), r)
r = run("update profiles set full_name='Hacked' where id=%s", S1, args=(S2,))
check("student cannot edit someone else's profile", r == 0, r)
r = run("select id from profiles", S1)
check("student sees only own profile", r == [(S1,)], r)
r = run("select count(*) from profiles", A)
check("admin sees all profiles", r == [(5,)], r)
r = run("update profiles set student_id='2024001' where id=auth.uid()", S2)
check("duplicate student ID rejected", is_err(r, "duplicate"), r)

r = run("select set_user_role(%s, 'organizer')", S1, args=(O,))
check("student cannot promote anyone", is_err(r, "NOT_ALLOWED"), r)
r = run("select set_user_role(%s, 'organizer')", A, args=(O,))
check("admin promotes organizer", not is_err(r), r)
r = run("select set_user_role(%s, 'student')", A, args=(A,))
check("last admin cannot demote themselves", is_err(r, "LAST_ADMIN"), r)

ins = """insert into events (title, category, event_date, start_time, location, capacity, rsvp_deadline, audience, audience_batches)
         values (%s, 'Sports', %s, '15:00', 'Field', %s, %s, %s, %s) returning id"""
r = run(ins, S1, args=("Hack", "2099-01-01", None, None, "everyone", []))
check("student cannot create events", is_err(r), r)
E1 = run(ins, O, args=("Everyone cap1", "2099-01-01", 1, None, "everyone", []))[0][0]
E2 = run(ins, O, args=("Batch 2025 only", "2099-01-01", None, None, "batch", [2025]))[0][0]
E3 = run(ins, O, args=("Custom invite", "2099-01-01", None, None, "custom", []))[0][0]
E4 = run(ins, O, args=("Deadline passed", "2099-01-01", None, "2020-01-01", "everyone", []))[0][0]
check("organizer creates 4 events", all([E1, E2, E3, E4]))

r = run("select set_event_invites(%s, %s::uuid[])", O, args=(E3, [str(S1)]))
check("organizer invites S1 to custom event", r == [(1,)], r)

s1_titles = {t for (t,) in run("select title from events", S1)}
s2_titles = {t for (t,) in run("select title from events", S2)}
check("S1 (batch 2024, invited) sees right events", s1_titles == {"Everyone cap1", "Custom invite", "Deadline passed"}, s1_titles)
check("S2 (batch 2025) sees right events", s2_titles == {"Everyone cap1", "Batch 2025 only", "Deadline passed"}, s2_titles)

r = run("select status from set_my_rsvp(%s, 'attending', 'see you')", S1, args=(E1,))
check("S1 RSVPs attending (one tap)", r == [("attending",)], r)
r = run("select status from set_my_rsvp(%s, 'attending')", S2, args=(E1,))
check("capacity enforced: S2 cannot take a full event", is_err(r, "EVENT_FULL"), r)
r = run("select status from set_my_rsvp(%s, 'maybe')", S2, args=(E1,))
check("S2 can still say maybe", r == [("maybe",)], r)
r = run("select status from set_my_rsvp(%s, 'not_attending')", S1, args=(E1,))
check("S1 changes RSVP (update path)", r == [("not_attending",)], r)
r = run("select status from set_my_rsvp(%s, 'attending')", S2, args=(E1,))
check("seat freed -> S2 can now attend", r == [("attending",)], r)
r = run("select status from set_my_rsvp(%s, 'maybe')", S3, args=(E1,))
check("incomplete profile cannot RSVP", is_err(r, "row-level security"), r)
r = run("select status from set_my_rsvp(%s, 'attending')", S1, args=(E2,))
check("cannot RSVP to an event not meant for you", is_err(r, "row-level security"), r)
r = run("select status from set_my_rsvp(%s, 'attending')", S1, args=(E4,))
check("cannot RSVP after the deadline", is_err(r, "row-level security"), r)
r = run("insert into rsvps (event_id, user_id, status) values (%s, %s, 'attending')", S1, args=(E3, S2))
check("cannot RSVP on someone else's behalf", is_err(r), r)

r = run("update rsvps set checked_in_at=now() where user_id=auth.uid()", S2)
check("student cannot check themselves in", is_err(r, "permission denied"), r)
r = run("select check_in(%s, %s)", O, args=(E1, S2))
check("organizer checks S2 in", not is_err(r) and r[0][0] is not None, r)

r = run("select user_id from rsvps", S1)
check("student sees only own RSVPs", {u for (u,) in r} == {S1}, r)
r = run("select attending, maybe, not_attending from event_rsvp_counts() where event_id=%s", S1, args=(E1,))
check("student sees counts only", r == [(1, 0, 1)], r)
r = run("select * from event_attendees(%s)", S1, args=(E1,))
check("student cannot read attendee list", is_err(r, "NOT_ALLOWED"), r)
r = run("select full_name, phone, status from event_attendees(%s)", O, args=(E1,))
check("organizer reads attendee list incl. phone", len(r) == 2 and all(p for (_, p, _) in r), r)
r = run("select * from list_members()", S1)
check("student cannot list members", is_err(r, "NOT_ALLOWED"), r)
r = run("select * from hub_stats()", O)
check("organizer cannot read admin stats", is_err(r, "NOT_ALLOWED"), r)
r = run("select members, rsvps, check_ins from hub_stats()", A)
check("admin reads stats", r == [(5, 2, 1)], r)

r = run("select * from events", None, role="anon")
check("signed-out visitor cannot read events", is_err(r, "permission denied"), r)
r = run("select * from profiles", None, role="anon")
check("signed-out visitor cannot read profiles", is_err(r, "permission denied"), r)
r = run("select * from event_rsvp_counts()", None, role="anon")
check("signed-out visitor cannot call functions", is_err(r, "permission denied"), r)

r = run("insert into clubs (name) values ('X')", O)
check("organizer cannot add clubs", is_err(r), r)
r = run("insert into clubs (name) values ('Chess Club') returning name", A)
check("admin adds a club", r == [("Chess Club",)], r)

r = run("select delete_my_account()", S2)
check("S2 deletes their account", not is_err(r), r)
check("S2's profile and RSVPs are gone",
      run("select (select count(*) from profiles where id=%s) + (select count(*) from rsvps where user_id=%s)", role=None, args=(S2, S2)) == [(0,)])
r = run("select delete_my_account()", A)
check("last admin cannot delete themselves", is_err(r, "LAST_ADMIN"), r)

print(f"\n{fails} failing checks")
sys.exit(1 if fails else 0)
