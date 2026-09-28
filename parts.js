function formatText(post) {
        let comment = ''
        if (!post) {
          return '' 
        } else if (!post.comment) {
          comment = post
        } else {
          comment = post.comment
        }
        const escaper = /(\s*)[<](\s*)/g
        comment = comment.replaceAll(escaper, `$1&lt;$2`)
        
        comment = partytext(comment)
        const regex = /@([0-9\s+]+|[OP\s+]+)/g
          
        return comment.replace(
          regex,
          `<a href="#$1" style="color: var(--rage)">@$1</a>`
        )
      }

      function partytext(c) {
        const spoiler = /\[\[\[([\s\S]*?)]]]/g
        let comment = c.replace(spoiler, `<s>$1</s>`)
        const array1 = comment.split("\n")
   
        let comment1 = ''
        const shake1 = /\[s1\]([\s\S]*?)\[\/s1\]/g
        const shake2 = /\[s2\]([\s\S]*?)\[\/s2\]/g
        const shake3 = /\[s3\]([\s\S]*?)\[\/s3\]/g
        const shake3a = /\[s3a\]([\s\S]*?)\[\/s3a\]/g
        const hori1 = /\[h1\]([\s\S]*?)\[\/h1\]/g
        const hori2 = /\[h2\]([\s\S]*?)\[\/h2\]/g
        const hori3 = /\[h3\]([\s\S]*?)\[\/h3\]/g
        const hori3a = /\[h3a\]([\s\S]*?)\[\/h3a\]/g
        const gay = /\[r\]([\s\S]*?)\[\/r\]/g
        const trans = /\[t\]([\s\S]*?)\[\/t\]/g
        const schizo = /\[tv\]([\s\S]*?)\[\/tv\]/g
        const schizoa = /\[tva\]([\s\S]*?)\[\/tva\]/g
        const yay = /\[v\]([\s\S]*?)\[\/v\]/g
        const yaya = /\[va\]([\s\S]*?)\[\/va\]/g
        const police = /\[p\]([\s\S]*?)\[\/p\]/g
        const bold = /\[b\]([\s\S]*?)\[\/b\]/g
        const italic = /\[i\]([\s\S]*?)\[\/i\]/g
        const big = /\[big\]([\s\S]*?)\[\/big\]/g
        const rage = /\[red\]([\s\S]*?)\[\/red\]/g

        const glow = /\[g\]([\s\S]*?)\[\/g\]/g
        array1.forEach((c) => {
         
            let pre = ''
            let end = ''
            if (c.startsWith('>')&& !c.startsWith('> ')) {
               pre = '<span class="greentext">' + pre
              end = end + '</span>'
            } else if (c.toLowerCase().startsWith("im gay") || c.toLowerCase().startsWith("i'm gay")) {
             pre = '<span class="gay">' + pre
              end = end + '</span>'
            } else if (c.toLowerCase().startsWith("im trans") || c.toLowerCase().startsWith("i'm trans")) {
             pre = '<span class="trans">' + pre
              end = end + '</span>'
            } else if (c.startsWith("THE VOICES")) {
             pre = '<span class="schizo">' + pre
              end = end + '</span>'
            }else if (c.toLowerCase().startsWith("yay")) {
             pre = '<span class="vert">' + pre
              end = end + '</span>'
            }else if (c.startsWith("POLICE")) {
             pre = '<span class="police">' + pre
              end = end + '</span>'
            }else if (c.startsWith("FUCK") || c.startsWith("WTF")) {
             pre = '<span class="rage">' + pre
              end = end + '</span>'
            }
          if (c.endsWith('!!!!!')) {
          //  comment1 = comment1 + '<span class="shake3">' + c + '</span>' + "\n"
           pre = '<span class="shake3">' + pre
          end = end + '</span>'
          
        } else if (c.endsWith('!!!!')) {
           pre = '<span class="shake2">' + pre
          end = end + '</span>'
          } else if (c.endsWith('!!!')) {
           pre = '<span class="shake1">' + pre
          end = end + '</span>'
        } else if (c.endsWith('....!')) {
           pre = '<span class="hori3">' + pre
          end = end + '</span>'
          } else if (c.endsWith('...!')) {
           pre = '<span class="hori2">' + pre
          end = end + '</span>'
        } else if (c.endsWith('..!')) {
           pre = '<span class="hori1">' + pre
          end = end + '</span>' } 
          else if (c.endsWith('?!?!?') || c.endsWith('!?!?!')) {
           pre = '<span class="shake3">' + pre
          end = end + '</span>'
          
        } else if (c.endsWith('?!?!') || c.endsWith('!?!?')) {
           pre = '<span class="shake2">' + pre
          end = end + '</span>'
          } else if (c.endsWith('?!?') || c.endsWith('!?!')) {
           pre = '<span class="shake1">' + pre
          end = end + '</span>'
        }else if (c.endsWith('.....')) {
           pre = '<span class="italic3">' + pre
          end = end + '</span>'
          } else if (c.endsWith('....')) {
           pre = '<span class="italic2">' + pre
          end = end + '</span>'
        } else if (c.endsWith('...')) {
           pre = '<span class="italic1">' + pre
          end = end + '</span>' } 
          
          else if(c === ''){
          
        } else {
          
           
           
        }
        comment1 = comment1 + pre + c + end + "\n"
        comment1 = comment1.replace(shake3a, '<span class="shake3a">$1</span>')
        comment1 = comment1.replace(shake3, '<span class="shake3">$1</span>')
        comment1 = comment1.replace(shake2, '<span class="shake2">$1</span>')
        comment1 = comment1.replace(shake1, '<span class="shake1">$1</span>')

        comment1 = comment1.replace(hori3a, '<span class="hori3a">$1</span>')
        comment1 = comment1.replace(hori3, '<span class="hori3">$1</span>')
        comment1 = comment1.replace(hori2, '<span class="hori2">$1</span>')
        comment1 = comment1.replace(hori1, '<span class="hori1">$1</span>')
        
        comment1 = comment1.replace(glow, '<span class="glow">$1</span>')
        comment1 = comment1.replace(gay, '<span class="gay">$1</span>')
        comment1 = comment1.replace(trans, '<span class="trans">$1</span>')
        comment1 = comment1.replace(schizo, '<span class="schizo">$1</span>')
        comment1 = comment1.replace(schizoa, '<span class="schizoa">$1</span>')
        comment1 = comment1.replace(yay, '<span class="vert">$1</span>')
        comment1 = comment1.replace(yaya, '<span class="verta">$1</span>')
        comment1 = comment1.replace(police, '<span class="police">$1</span>')
        comment1 = comment1.replace(rage, '<span class="rage">$1</span>')
        comment1 = comment1.replace(big, '<span class="big">$1</span>')
        comment1 = comment1.replace(bold, '<span class="bold">$1</span>')
        comment1 = comment1.replace(italic, '<span class="italic">$1</span>')


    
        })
        
        return comment1
      }

module.exports = {
    formatText
}