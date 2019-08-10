const serverProperties = require('./ServerProperties.json');
const gameplayProperties = require('./GameplayProperties.json');

const Discord = require('discord.js');
const client = new Discord.Client();
const config = require('./config.json');
const sqlite3 = require('sqlite3').verbose();

var ignoreDate = false;

function Error(err) {
    let error = false;
    if (err) {
        console.error(err);
        error = true;
    }
    return error;
}

// Check if should level up then level up
function LevelUp(member, senderID, score, playerScore) {

    // Get current level from database
    db.all("SELECT BeamCount FROM GameplayVariables", [], function (err, results) {
        if (!Error(err)) {
            let beamCount = results[0].BeamCount;

            // Get next level from database
            db.all("SELECT NextLevel FROM GameplayVariables", [], function (err, results) {
                if (!Error(err)) {
                    let nextLevel = results[0].NextLevel;

                    // Check if at threshold
                    if (beamCount >= nextLevel) {
                        // Get current level
                        db.all("SELECT Level FROM GameplayVariables", [], function (err, results) {
                            if (!Error(err)) {
                                let currentLevel = results[0].Level;

                                // Increment currentLevel
                                currentLevel++;

                                // Double nextLevel
                                nextLevel *= 2;

                                // Update database
                                db.run("UPDATE GameplayVariables SET Level = ?", [currentLevel], function (err) {
                                    if (!Error(err)) {
                                        db.run("UPDATE GameplayVariables SET NextLevel = ?", [nextLevel], function (err) {
                                            if (!Error(err)) {
                                                // Calculate how many beams required till next level
                                                let requiredBeams = nextLevel - score;

                                                // Level up!
                                                client.channels.get(config.the_beam).send
                                                ("<:birb:254399898600865794> We are in the beam! Beam level is now **" + currentLevel + "** | **" + nextLevel + "** beams required for next level (" + requiredBeams + " beams to go).");
                                            }
                                        });
                                    }
                                });
                            }
                        });
                    }
                }
            });
        }
    });

    // Check personal level
    db.all("SELECT * FROM Players WHERE UserID = ?", [senderID], function (err, results) {
        if (!Error(err)) {
            let personalScore = results[0].Score;
            let personalLevel = results[0].Level;
            let personalNextLevel = results[0].NextLevel;

            // If need to level up
            if (personalScore >= personalNextLevel) {
                personalLevel++;
                personalNextLevel *= 2;

                // Update database
                db.run("UPDATE Players SET Level = ? WHERE UserId = ?", [personalLevel, senderID], function (err) {
                    if (!Error(err)) {
                        db.run("UPDATE Players SET NextLevel = ? WHERE UserID = ?", [personalNextLevel, senderID], function (err) {
                            if (!Error(err)) {
                                // Calculate required beams
                                let requiredBeams = personalNextLevel - playerScore;

                                // Create text if player has a new role
                                let roleLevel = AddLevelRole(member, personalLevel);

                                // Level up!
                                client.channels.get(config.the_beam).send
                                ("<:birb:254399898600865794> You are in the beam! Congratulations **" + client.users.get(senderID).username + "**, your Beam level is now ** " + personalLevel + " ** | **" + requiredBeams + "** beams required for next level (" + (personalNextLevel - playerScore) + " beams to go)." + roleLevel);
                            }
                        });
                    }
                });
            }
        }
    });
}

// Function to add a role to player when they level up
function AddLevelRole(member, level) {
    // Check level of user
    switch (level) {
        case 1: {
            // Add role
            member.addRole(member.guild.roles.get(serverProperties.Bandwagon_Beamers.id));

            // Return
            return "You have also earned the role of **" + serverProperties.Bandwagon_Beamers.name + "**!";
            break;
        }
        case 2: {
            // Remove role
            member.removeRole(serverProperties.Bandwagon_Beamers.id);

            // Add role
            member.addRole(member.guild.roles.get(serverProperties.Small_Time_Beamers.id));

            // Return
            return "You have also earned the role of **" + serverProperties.Small_Time_Beamers.name + "**!";
            break;
        }
        case 4: {
            // Remove role
            member.removeRole(serverProperties.Small_Time_Beamers.id);

            // Add role
            member.addRole(member.guild.roles.get(serverProperties.Beam_Benders.id));

            // Return
            return "You have also earned the role of **" + serverProperties.Beam_Benders.name + "**!";
            break;
        }
        case 6: {
            // Remove role
            member.removeRole(serverProperties.Beam_Benders.id);

            // Add role
            member.addRole(member.guild.roles.get(serverProperties.Baby_Beamers.id));

            // Return
            return "You have also earned the role of **" + serverProperties.Baby_Beamers.name + "**!";
            break;
        }
        case 8: {
            // Remove role
            member.removeRole(serverProperties.Baby_Beamers.id);

            // Add role
            member.addRole(member.guild.roles.get(serverProperties.Beam_Connoisseurs.id));

            // Return
            return "You have also earned the role of **" + serverProperties.Beam_Connoisseurs.name + "**!";
            break;
        }
        case 10: {
            // Remove role
            member.removeRole(serverProperties.Beam_Connoisseurs.id);

            // Add role
            member.addRole(member.guild.roles.get(serverProperties.Beam_Daddy.id));

            // Return
            return "You have also earned the role of **" + serverProperties.Beam_Daddy.name + "**!";
            break;
        }
    }

    // If none of the above
    return "";
}

// Increment the player's personal score
function IncrementPersonalScore(msg, member, senderID, date, score, bonus) {

    // Let the player know their message was received successfully
    msg.react(serverProperties.Success_Emoji);

    // Get player's score
    db.all("SELECT Score FROM Players WHERE UserID = ?", [senderID], function (err, results) {
        if (!Error(err)) {
            let personalScore = results[0].Score;

            // Increment the score
            personalScore++;

            // Add bonus
            personalScore += bonus;

            // Update the Database
            db.run("UPDATE Players SET Score = ? WHERE UserID = ?", [personalScore, senderID], function (err) {
                if (!Error(err)) {
                    console.log("Player's score has been updated");

                    // Update player's last post date
                    db.run("UPDATE Players SET lastPostDate = ? WHERE UserID = ?", [date, senderID], function (err) {
                        if (!Error(err)) {
                            console.log("Player's lastPostDate has been set to " + date + ".");
                        }
                    });

                    // Check if level up
                    LevelUp(member, senderID, score, personalScore);
                }
            })
        }
    });
}

// Print the stats
function PrintStats(senderID, msg) {

    // Get stats from database
    db.all("SELECT * FROM GameplayVariables", [], function (err, results) {
        if (!Error(err)) {

            // Get personal stats from database
            db.all("SELECT * FROM Players WHERE UserID = ?", [senderID], function (err, playerResults) {
                if (!Error(err)) {

                    // Get Overall stats
                    let beamCount = results[0].BeamCount;
                    let level = results[0].Level;
                    let nextLevel = results[0].NextLevel;

                    // Get personal stats
                    let personalScore = playerResults[0].Score;
                    let personalLevel = playerResults[0].Level;
                    let personalNextLevel = playerResults[0].NextLevel;

                    // Show current beamCount
                    client.channels.get(config.the_beam).send
                    ("Overall Beam count is **" + beamCount + "**. Current level is **" + level + "**. Next level requires **" + nextLevel + "** beams (" + (nextLevel - beamCount) + " beams to go).\n" +
                        "<@" + senderID + ">, your personal Beam count is **" + personalScore + "**. Your current level is **" + personalLevel + "**. Next level requires **" + personalNextLevel + "** beams (" + (personalNextLevel - personalScore) + " beams to go).");

                    // React to message
                    msg.react(serverProperties.Success_Emoji);
                }
            });
        }
    });
}

// Function to reset a player's stats
function ResetStats(member, playerID, msg) {
    // // Reset the stats
    // db.run("UPDATE Players SET Score = 0, Level = 0, NextLevel = 1, lastPostDate = NULL, Class = NULL, LastClassChangeDate = NULL, Cloaked = 0, CloakDate = NULL WHERE UserID = ?", [playerID], function (err) {
    //     if (!Error(err)) {
    //         console.log(client.users.get(playerID).username + "'s stats have been reset");
    //     }
    // });

    // Delete the player's stats
    db.run("DELETE FROM Players WHERE UserID = ?", [playerID], function (err) {
        if (!Error(err)) {
            console.log("Player's stats have been deleted");
        }
    });

    // Check roles and remove them
    if (member.roles.has(serverProperties.Bandwagon_Beamers.id)) member.removeRole(serverProperties.Bandwagon_Beamers.id);
    else if (member.roles.has(serverProperties.Small_Time_Beamers.id)) member.removeRole(serverProperties.Small_Time_Beamers.id);
    else if (member.roles.has(serverProperties.Beam_Benders.id)) member.removeRole(serverProperties.Beam_Benders.id);
    else if (member.roles.has(serverProperties.Baby_Beamers.id)) member.removeRole(serverProperties.Baby_Beamers.id);
    else if (member.roles.has(serverProperties.Beam_Connoisseurs.id)) member.removeRole(serverProperties.Beam_Connoisseurs.id);
    else if (member.roles.has(serverProperties.Beam_Daddy.id)) member.removeRole(serverProperties.Beam_Daddy.id);

    // React to message
    msg.react(serverProperties.Success_Emoji);
}

// Function to reset main stats
function ResetAll(msg) {
    // Reset the stats
    db.run("UPDATE GameplayVariables SET BeamCount = 0, Level = 0, NextLevel = 1", [], function (err) {
        if (!Error(err)) {
            console.log("Stats have been reset");
        }
    })

    // Reset beamCount
    beamCount = 0;

    // React to message
    msg.react(serverProperties.Success_Emoji);
}

// Function to calculate if a player should become small daddy
function CalculateSmallDaddy(member) {
    // Check if member already is Small Daddy
    if (!member.roles.has(serverProperties.smallDaddy)) {
        // Generate random number
        let min = 0;
        let max = 100;
        let randInt = Math.floor(Math.random() * (+max - +min) + +min);

        // Check if randInt is 0
        if (randInt == 0) {
            // Get Small Daddy roles
            let smallDaddyRole = member.guild.roles.get(serverProperties.smallDaddy);

            // Find current Small Daddy role
            let smallDaddy = smallDaddyRole.members.map(m => m.user.id);

            // Check if small Daddy has a value
            if (smallDaddy[0]) {
                // Remove their role
                member.guild.members.get(smallDaddy[0]).removeRole(smallDaddyRole).catch(console.error);
            }

            // The player will become small daddy
            member.addRole(smallDaddyRole).catch(console.error);

            // Let the user know
            client.channels.get(config.the_beam).send("Congratulations, <@" + member.id + ">. You have been selected to become **Small Daddy**!");
        }
    }
}

// Connect to SQLite Database
let db = new sqlite3.Database('./db.sqlite', (err) => {
    if (err) {
        return console.error(err.message);
    }
    console.log('Connected to the in-memory SQlite database.');
});

// Counter for how many beams have been posted
var beamCount = null
db.all("SELECT BeamCount FROM GameplayVariables WHERE id = 1", [], function (err, result) {
    if (err) {
        console.log(err);
    }
    beamCount = result[0].BeamCount;
});

// Function to change a player's class
function ChangeClass(msg, member, playerClass) {
    // Get current date
    let date = GetDate().substr(0, 7);

    // Check if player in database
    db.all("SELECT * FROM Players WHERE UserID = ?", [member.id], function (err, results) {
        if (!Error(err)) {
            // If results found
            if (results[0]) {
                // Get player's last class change date
                db.all("SELECT LastClassChangeDate FROM Players WHERE Userid = ?", [member.id], function (err, results) {
                    if (!Error(err)) {

                        // Get result
                        var lastClassChangeDate = results[0].LastClassChangeDate;

                        // Check if can post
                        if (lastClassChangeDate != date && !ignoreDate) {
                            // Select correct path
                            switch (playerClass) {
                                // Add class and change date to the database
                                case "scout":
                                    db.run("UPDATE Players SET Class = 'scout' WHERE UserId = ?", [member.id], function (err) {
                                        if (!Error(err)) {
                                            db.run("UPDATE Players SET LastClassChangeDate = ? WHERE UserId = ?", [date, member.id], function (err) {
                                                if (!Error(err)) {
                                                    console.log("Player's class has been changed");
                                                    msg.react(serverProperties.Success_Emoji);
                                                }
                                            });
                                        }
                                    });
                                    break;
                                case "soldier":
                                    db.run("UPDATE Players SET Class = 'soldier' WHERE UserId = ?", [member.id], function (err) {
                                        if (!Error(err)) {
                                            db.run("UPDATE Players SET LastClassChangeDate = ? WHERE UserId = ?", [date, member.id], function (err) {
                                                if (!Error(err)) {
                                                    console.log("Player's class has been changed");
                                                    msg.react(serverProperties.Success_Emoji);
                                                }
                                            });
                                        }
                                    });
                                    break;
                                case "pyro":
                                    db.run("UPDATE Players SET Class = 'pyro' WHERE UserId = ?", [member.id], function (err) {
                                        if (!Error(err)) {
                                            db.run("UPDATE Players SET LastClassChangeDate = ? WHERE UserId = ?", [date, member.id], function (err) {
                                                if (!Error(err)) {
                                                    console.log("Player's class has been changed");
                                                    msg.react(serverProperties.Success_Emoji);
                                                }
                                            });
                                        }
                                    });
                                    break;
                                case "demoman":
                                    db.run("UPDATE Players SET Class = 'demoman' WHERE UserId = ?", [member.id], function (err) {
                                        if (!Error(err)) {
                                            db.run("UPDATE Players SET LastClassChangeDate = ? WHERE UserId = ?", [date, member.id], function (err) {
                                                if (!Error(err)) {
                                                    console.log("Player's class has been changed");
                                                    msg.react(serverProperties.Success_Emoji);
                                                }
                                            });
                                        }
                                    });
                                    break;
                                case "heavy":
                                    db.run("UPDATE Players SET Class = 'heavy' WHERE UserId = ?", [member.id], function (err) {
                                        if (!Error(err)) {
                                            db.run("UPDATE Players SET LastClassChangeDate = ? WHERE UserId = ?", [date, member.id], function (err) {
                                                if (!Error(err)) {
                                                    console.log("Player's class has been changed");
                                                    msg.react(serverProperties.Success_Emoji);
                                                }
                                            });
                                        }
                                    });
                                    break;
                                case "engineer":
                                    db.run("UPDATE Players SET Class = 'engineer' WHERE UserId = ?", [member.id], function (err) {
                                        if (!Error(err)) {
                                            db.run("UPDATE Players SET LastClassChangeDate = ? WHERE UserId = ?", [date, member.id], function (err) {
                                                if (!Error(err)) {
                                                    console.log("Player's class has been changed");
                                                    msg.react(serverProperties.Success_Emoji);
                                                }
                                            });
                                        }
                                    });
                                    break;
                                case "medic":
                                    db.run("UPDATE Players SET Class = 'medic' WHERE UserId = ?", [member.id], function (err) {
                                        if (!Error(err)) {
                                            db.run("UPDATE Players SET LastClassChangeDate = ? WHERE UserId = ?", [date, member.id], function (err) {
                                                if (!Error(err)) {
                                                    console.log("Player's class has been changed");
                                                    msg.react(serverProperties.Success_Emoji);
                                                }
                                            });
                                        }
                                    });
                                    break;
                                case "sniper":
                                    db.run("UPDATE Players SET Class = 'sniper' WHERE UserId = ?", [member.id], function (err) {
                                        if (!Error(err)) {
                                            db.run("UPDATE Players SET LastClassChangeDate = ? WHERE UserId = ?", [date, member.id], function (err) {
                                                if (!Error(err)) {
                                                    console.log("Player's class has been changed");
                                                    msg.react(serverProperties.Success_Emoji);
                                                }
                                            });
                                        }
                                    });
                                    break;
                                case "spy":
                                    db.run("UPDATE Players SET Class = 'spy' WHERE UserId = ?", [member.id], function (err) {
                                        if (!Error(err)) {
                                            db.run("UPDATE Players SET LastClassChangeDate = ? WHERE UserId = ?", [date, member.id], function (err) {
                                                if (!Error(err)) {
                                                    console.log("Player's class has been changed");
                                                    msg.react(serverProperties.Success_Emoji);
                                                }
                                            });
                                        }
                                    });
                                    break;
                                default:
                                    msg.react(serverProperties.Invalid_Class_Emoji);
                            }
                        } else {
                            // Report error
                            msg.react(serverProperties.Class_Date_Error_Emoji);
                        }
                    }
                });
            }
        }
    });
}

// Function to get the date
function GetDate() {
    let date = new Date().toISOString();

    // Remove time from date
    date = date.substring(0, 10);

    // Return
    return date;
}

// Check the player's class
function CheckClass(msg, senderID, date, beamCount) {

    // Get the player's class
    db.all("SELECT Class FROM Players WHERE UserID = ?", [senderID], function (err, results) {
        if (!Error(err)) {
            // Instantiate bonus variable
            let bonus = 0;

            // Store class in variable
            let playerClass = results[0].Class;

            // Select correct path
            switch (playerClass) {
                case "scout":
                    // Get last post date
                    db.all("SELECT lastPostDate FROM Players WHERE UserID = ?", [senderID], function (err, results) {
                        if (!Error(err)) {
                            // Get date as variable
                            let lastPostDate = new Date(results[0].lastPostDate);

                            // Find day after lastPostDate
                            let dayAfterLastPostDate = new Date();
                            dayAfterLastPostDate.setDate(lastPostDate.getDate() + 1);

                            // Get todays date
                            let todaysDate = new Date();

                            // Set date hours
                            lastPostDate.setHours(24, 0, 0, 0);
                            dayAfterLastPostDate.setHours(24, 0, 0, 0);
                            todaysDate.setHours(24, 0, 0, 0);

                            // Set dates to ISO
                            lastPostDate = lastPostDate.toISOString();
                            dayAfterLastPostDate = dayAfterLastPostDate.toISOString();
                            todaysDate = todaysDate.toISOString();

                            // Check if today's date is greater
                            if (todaysDate > dayAfterLastPostDate) {
                                // Streak broken, set streak back to 1
                                db.run("UPDATE Players SET Streak = ? WHERE UserId = ?", [1, senderID], function (err) {
                                    if (!Error(err)) {
                                        console.log("Player's streak has been reset");
                                    }
                                });
                            } else if (todaysDate == lastPostDate) {
                                console.log("Can't increase streak when already posted today");
                            } else {
                                // Streak continued, get streak
                                db.all("SELECT Streak FROM Players WHERE UserID = ?", [senderID], function (err, results) {
                                    if (!Error(err)) {
                                        // Store result in variable
                                        let streak = results[0].Streak;

                                        // Increment streak
                                        streak++;
                                        console.log(streak);
                                        // If streak is greater than threshold
                                        if (streak >= gameplayProperties.streakBonus) {
                                            // Send the player a message
                                            client.channels.get(config.the_beam).send("<@" + senderID + "> Beam Streak! **+2** bonus beams!");

                                            // Set bonus
                                            bonus = 2;

                                            // Set streak back to 0
                                            db.run("UPDATE Players SET Streak = ? WHERE UserId = ?", [0, senderID], function (err) {
                                                if (!Error(err)) {
                                                    console.log("Player's streak has been reset");
                                                }
                                            });
                                        } else {
                                            // Update streak
                                            db.run("UPDATE Players SET Streak = ? WHERE UserId = ?", [streak, senderID], function (err) {
                                                if (!Error(err)) {
                                                    console.log("Player's streak has been updated");
                                                }
                                            });
                                        }

                                        // Increment personal score
                                        IncrementPersonalScore(msg, msg.member, senderID, date, beamCount, bonus);
                                    }
                                });
                            }
                        }
                    });
                    break;
                case "soldier":
                    // Generate random int from 0 to 10
                    let min = 0;
                    let max = 10;
                    let randInt = Math.floor(Math.random() * (+max - +min) + +min);

                    // If randInt is 0
                    if (randInt == 0) {
                        // Player got a market gardener!
                        bonus = gameplayProperties.marketGardenerBonus;

                        // Send a message
                        client.channels.get(config.the_beam).send("<@" + senderID + ">You got a market gardener! +" + gameplayProperties.marketGardenerBonus + " bonus beams!");
                    }

                    // Increment personal score
                    IncrementPersonalScore(msg, msg.member, senderID, date, beamCount, bonus);

                    break;
                case "pyro":
                    break;
                case "demoman":
                    break;
                case "heavy":
                    break;
                case "engineer":
                    break;
                case "medic":
                    break;
                case "sniper":
                    break;
                case "spy":

                    // Check if spy is cloaked
                    db.all("SELECT Cloaked FROM Players WHERE UserID = ?", [senderID], function (err, results) {
                        if (!Error(err)) {
                            // Store result in variable
                            let cloaked = results[0].Cloaked;

                            // Get current date
                            let date = new Date();

                            // Set date hours
                            date.setHours(24, 0, 0, 0);

                            // Convert date to iso
                            date = date.toISOString();

                            // If not cloaked
                            if (cloaked == 0) {
                                // Set cloaked to true
                                db.run("UPDATE Players SET Cloaked = ? WHERE UserID = ?", [1, senderID], function (err) {
                                    if (!Error(err)) {
                                        // Store date in database
                                        db.run("UPDATE Players SET CloakDate = ? WHERE UserID = ?", [date, senderID], function (err) {
                                            if (!Error(err)) {
                                                console.log("Cloak date has been stored in the databased");
                                            }
                                        });
                                    }
                                });
                            }
                            // If cloaked
                            else {
                                // Get cloak date
                                db.all("SELECT CloakDate FROM Players WHERE UserID = ?", [senderID], function (err, results) {
                                    if (!Error(err)) {
                                        // Store CloakDate in variable
                                        let cloakDate = new Date(results[0].CloakDate);

                                        // Get day after cloakDate
                                        let nextDay = new Date();
                                        nextDay.setDate(cloakDate.getDate() + 1);

                                        // Set hours
                                        nextDay.setHours(0, 0, 0, 0);

                                        // Set nextDay to iso
                                        nextDay = nextDay.toISOString();

                                        // Get day two days after cloakDate
                                        let twoDays = new Date();
                                        twoDays.setDate(cloakDate.getDate() + 2);

                                        // Set hours
                                        twoDays.setHours(0, 0, 0, 0);

                                        // Set twoDays to iso
                                        twoDays = twoDays.toISOString();

                                        // Set cloakDate to iso
                                        cloakDate = cloakDate.toISOString();

                                        // Compare cloakDate to current date
                                        if (date == twoDays) {

                                            // Player got a backstab!
                                            client.channels.get(config.the_beam).send("<@" + senderID + "> You got a backstab! **+1** bonus beam!");

                                            // Set bonus
                                            bonus = 1;

                                            // Set last cloak date
                                            db.run("UPDATE Players SET CloakDate = ? WHERE UserID = ?", [date, senderID], function (err) {
                                                if (!Error(err)) {
                                                    // Increment personal score
                                                    IncrementPersonalScore(msg, msg.member, senderID, date, beamCount, bonus);
                                                }
                                            });
                                        } else if (date == cloakDate) {
                                            console.log("You cannot post yet");
                                        } else if (date == nextDay) {
                                            // Reply to player
                                            client.channels.get(config.the_beam).send("<@" + senderID + "> You are cloaked.");

                                            // Set reaction
                                            msg.react(serverProperties.Invalid_Command_Emoji);
                                        } else {

                                            // The player messed up
                                            client.channels.get(config.the_beam).send("<@" + senderID + "> You missed your backstab. Try again tomorrow.");

                                            // Set cloaked to false
                                            db.run("UPDATE Players SET Cloaked = 0, CloakDate = NULL WHERE UserID = ?", [senderID], function (err) {
                                                if (!Error(err)) {
                                                    IncrementPersonalScore(msg, msg.member, senderID, date, beamCount, bonus);
                                                }
                                            });
                                        }
                                    }
                                });
                            }
                        }
                    });
                    break;
                default:
                    // Increment personal score
                    IncrementPersonalScore(msg, msg.member, senderID, date, beamCount, bonus);

            }
        }
    });
}

// Send message stating bot is ready
client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

// On receiving a message
client.on('message', msg => {

    // Check if message was sent by bot
    if (!msg.author.bot) {
        // Check if message was posted in #the_beam
        if (msg.channel.id === config.the_beam) {

            // Declare array
            let words;

            // Check if message contains spaces
            if (msg.content.includes(" ")) {
                // Split message
                words = msg.content.split(" ");
            }
            // Else don't need to split message
            else words = [msg.content];

            // If the user wants stats
            if (msg.content === "!stats") {
                // Get user ID
                let senderID = msg.member.id;
                PrintStats(senderID, msg);
            }

            // If I want to reset a players stats
            else if (words[0] == "!reset") {
                // Check if second word
                if (words[1]) {
                    // If admin
                    if (msg.member.id == 130089317614747648) ResetStats(msg.member, words[1], msg);
                }
            }

            // If message is !resetAll
            else if (msg.content == "!resetall") {
                // If admin
                if (msg.member.id == 130089317614747648) ResetAll(msg);
            }

            // If message is toggling ignoreDate
            else if (words[0] == "!ignoredate") {
                // If admin
                if (msg.member.id == 130089317614747648) {
                    if (ignoreDate == true) {
                        console.log("Date is no longer being ignored");
                        ignoreDate = false;

                        // React to message
                        msg.react(serverProperties.Success_Emoji);
                    } else {
                        console.log("Date is being ignored");
                        ignoreDate = true;

                        // React to message
                        msg.react(serverProperties.Success_Emoji);
                    }
                }
            }
            // If message is as user changing their class
            else if (words[0] == "!class") {
                // Check if second word
                if (words[1])
                    ChangeClass(msg, msg.member, words[1].toLowerCase());
                else msg.react(serverProperties.Invalid_Class_Emoji);
            } else {
                // Variable to check if should mark message as rejected
                let noError = false;

                // Check if first letter is !
                if (msg.content[0] === "!") {
                    words[0] = words[0].slice(1);
                }

                // Loop through all words in message
                for (let i = 0; i < words.length; i++) {

                    // Get word
                    let word = words[i].toLowerCase();

                    // Check if the message is "beam"
                    if (word === 'beam') {
                        // Set no error to true
                        noError = true;

                        // Get user ID
                        let senderID = msg.member.id;


                        // Find UserID in table
                        db.all("SELECT * FROM Players WHERE UserID = ?", [senderID], function (err, results) {
                            if (!Error(err)) {

                                // Get current date
                                let date = GetDate();

                                // Check if any results
                                if (results[0]) {
                                    // Get player's lastPostDate
                                    db.all("SELECT lastPostDate FROM Players WHERE UserID = ? ", [senderID], function (err, results) {
                                        // If not error
                                        if (!Error(err)) {
                                            // Get player's last post date
                                            let lastPostDate = results[0].lastPostDate;

                                            // Check if result is equal to current date
                                            if (lastPostDate == date && !ignoreDate) {

                                                // Error
                                                console.log("User has already posted today.");
                                                msg.react(serverProperties.Date_Error_Emoji);

                                            } else {
                                                // Increment beamCount
                                                beamCount++;

                                                // Check the player's class
                                                CheckClass(msg, senderID, date, beamCount);
                                            }
                                        }
                                    });
                                }
                                // Else if no results then add a player to the database
                                else {
                                    db.run("INSERT INTO Players(UserID) VALUES(?)", [senderID], function (err) {
                                        if (!Error(err)) {
                                            console.log("User added with ID " + senderID);

                                            // Increment beamCount
                                            beamCount++;

                                            // Increment the score
                                            IncrementPersonalScore(msg, msg.member, senderID, date, beamCount, 0);
                                        }
                                    });
                                }

                            }
                        });

                        // Update database
                        db.run("UPDATE GameplayVariables SET BeamCount = ? WHERE id = ?", [beamCount, 1], function (err) {
                            if (!Error(err)) {

                                // See if the poster should become small daddy
                                CalculateSmallDaddy(msg.member);

                                // Say that the bot has been saved
                                console.log("Bot has been saved");
                            }
                        });
                    }
                }

                // If there was an error then add a reaction
                if (!noError) {
                    msg.react(serverProperties.Invalid_Command_Emoji);
                }
            }
        }
    }
});

// Login to Discord API
client.login(config.token);
