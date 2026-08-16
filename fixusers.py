import sqlite3
conn = sqlite3.connect('rideinsight.db')
users = conn.execute('SELECT id, username, email FROM users').fetchall()
print('Current users:', users)
conn.execute('DELETE FROM users WHERE username LIKE "%@%"')
conn.commit()
print('Done - deleted email-as-username accounts')
print('Remaining:', conn.execute('SELECT id, username FROM users').fetchall())
conn.close()